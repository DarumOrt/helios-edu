import "server-only";
import { NextResponse } from "next/server";
import { getDemoActor } from "@/mocks/demo-actor";
import { courseIdsForGroup } from "@/mocks/cohorts-store";
import { allDemoUsers } from "@/mocks/users-store";
import { canEditCourse } from "@/shared/auth/management";
import { backendForward } from "@/shared/lib/backend";
import { fail, readJson } from "@/mocks/management-guards";
import {
  adaptiveState as state,
  courseById,
  ensureSkills,
  event,
  learn,
  masteries,
  materials,
  newId,
  next,
  override,
  progress,
  questionSkills,
  saveMastery,
  skillInfos,
  type Attempt,
  type StoredQuestion,
  type StoredSkill,
} from "@/mocks/adaptive-store";
import type { AdaptiveQuestion, AttemptsSummary, Course, User } from "@/shared/types/domain";

// Маршруты адаптивного обучения (P5). В серверном режиме запрос целиком уходит в C# API
// (Adaptive/*Endpoints.cs), в демо — сюда: те же пути, права, ответы и тексты ошибок.
export async function adaptiveRoute(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const forwarded = await backendForward(req, url.pathname + url.search);
  if (forwarded) return forwarded;
  return demoAdaptive(req, url);
}

type Scope = { actor: User; course: Course; teacher: boolean };
type Need = "any" | "teacher" | "student";

const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
const noContent = () => new NextResponse(null, { status: 204 });
const invalid = (fields: Record<string, string>) => fail(400, "Проверьте поля формы", fields);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const optional = (v: unknown) => text(v) || null;

/** Доступ к курсу — как AdaptiveScopeFilter: ученик курса (по группе, как весь демо-режим) или его преподаватель */
async function scope(courseId: string, need: Need, mine: boolean): Promise<Scope | NextResponse> {
  const actor = await getDemoActor();
  if (need === "teacher" && actor.role === "student") return fail(403, "Недостаточно прав");
  if (need === "student" && actor.role !== "student") return fail(403, "Недостаточно прав");
  const course = courseById(courseId);
  if (!course) return fail(404, "Курс не найден");
  if (actor.role === "student") {
    const enrolled = course.status === "published" && courseIdsForGroup(actor.group).has(course.id);
    if (!enrolled) return mine ? fail(403, "Вы не записаны на этот курс") : fail(404, "Курс не найден");
    return { actor, course, teacher: false };
  }
  if (!canEditCourse(actor, course)) return fail(404, "Курс не найден");
  return { actor, course, teacher: true };
}

function studentsOf(course: Course): User[] {
  return allDemoUsers()
    .filter((u) => u.role === "student" && courseIdsForGroup(u.group).has(course.id))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

const studentView = (q: StoredQuestion): AdaptiveQuestion => ({
  id: q.id,
  type: q.type,
  text: q.text,
  options: q.options,
  skillId: q.skillId ?? null,
  order: q.order,
  hintsCount: q.hints.length,
});
const teacherView = ({ courseId: _c, activityId: _a, ...q }: StoredQuestion): AdaptiveQuestion => q;

function quizActivity(course: Course, activityId: string): NextResponse | null {
  const activity = materials(course).find((a) => a.id === activityId);
  if (!activity) return fail(404, "Материал не найден");
  return activity.type === "quiz" ? null : invalid({ activityId: "Это не тест" });
}

export async function demoAdaptive(req: Request, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = req.method;
  let m: RegExpExecArray | null;

  // ---- ученик: прогресс, следующее задание, события, рекомендации ----
  if ((m = /^\/api\/me\/courses\/([^/]+)\/(progress|next|events)$/.exec(path))) {
    const s = await scope(decodeURIComponent(m[1]), "student", true);
    if (s instanceof NextResponse) return s;
    if (m[2] === "progress" && method === "GET") return ok(progress(s.course, s.actor.id));
    if (m[2] === "next" && method === "GET") return ok(next(s.course, s.actor.id));
    if (m[2] === "events" && method === "POST") return recordEvent(req, s);
  }
  if ((m = /^\/api\/me\/recommendations\/([^/]+)$/.exec(path)) && method === "POST") {
    const actor = await getDemoActor();
    if (actor.role !== "student") return fail(403, "Недостаточно прав");
    const rec = state.recommendations.find(
      (r) => r.id === decodeURIComponent(m![1]) && r.userId === actor.id,
    );
    if (!rec) return fail(404, "Рекомендация не найдена");
    const status = text((await readJson(req))?.status);
    if (status !== "accepted" && status !== "skipped")
      return invalid({ status: "Выберите accepted или skipped" });
    if (rec.status === status) return noContent();
    if (rec.status !== "shown") return fail(409, "Рекомендация уже обработана");
    rec.status = status;
    event({
      userId: actor.id,
      actorId: actor.id,
      courseId: rec.courseId,
      type: `recommendation.${status}`,
      payload: { recommendationId: rec.id, reason: rec.reasonText },
      activityId: rec.activityId,
      skillId: rec.skillId,
    });
    return noContent();
  }

  // ---- попытки ----
  if ((m = /^\/api\/attempts\/([^/]+)\/(answers|hint|submit)$/.exec(path)) && method === "POST") {
    const actor = await getDemoActor();
    if (actor.role !== "student") return fail(403, "Недостаточно прав");
    const attempt = state.attempts.find((a) => a.id === decodeURIComponent(m![1]) && a.userId === actor.id);
    if (!attempt) return fail(404, "Попытка не найдена");
    const s = await scope(attempt.courseId, "student", true);
    if (s instanceof NextResponse) return s;
    if (m[2] === "submit") return submit(attempt);
    if (attempt.submittedAt) return fail(409, "Попытка уже завершена");
    return m[2] === "answers" ? answer(req, attempt, s) : hint(req, attempt);
  }

  // ---- внутри курса ----
  if (!(m = /^\/api\/courses\/([^/]+)\/(.+)$/.exec(path))) return fail(404, "not found");
  const courseId = decodeURIComponent(m[1]);
  const rest = m[2];

  if (rest === "skills") {
    const s = await scope(courseId, method === "GET" ? "any" : "teacher", false);
    if (s instanceof NextResponse) return s;
    if (method === "GET") return ok(skillInfos(s.course));
    if (method === "POST") return createSkill(req, s);
  }
  if (rest === "skills/import" && method === "POST") {
    const s = await scope(courseId, "teacher", false);
    return s instanceof NextResponse ? s : importSkills(req, s);
  }
  if ((m = /^skills\/([^/]+)$/.exec(rest))) {
    const s = await scope(courseId, "teacher", false);
    if (s instanceof NextResponse) return s;
    const skill = state.skills.find((x) => x.id === decodeURIComponent(m![1]) && x.courseId === courseId);
    if (!skill) return fail(404, "Навык не найден");
    if (method === "PATCH") return patchSkill(req, s, skill);
    if (method === "DELETE") return deleteSkill(skill);
  }
  if ((m = /^activities\/([^/]+)\/skills$/.exec(rest)) && method === "PUT") {
    const s = await scope(courseId, "teacher", false);
    return s instanceof NextResponse ? s : linkSkills(req, s, decodeURIComponent(m[1]));
  }
  if ((m = /^quizzes\/([^/]+)\/(questions|attempts)$/.exec(rest))) {
    const activityId = decodeURIComponent(m[1]);
    const need: Need = m[2] === "attempts" ? "student" : method === "GET" ? "any" : "teacher";
    const s = await scope(courseId, need, false);
    if (s instanceof NextResponse) return s;
    const notQuiz = quizActivity(s.course, activityId);
    if (notQuiz) return notQuiz;
    if (m[2] === "attempts" && method === "POST") return startAttempt(s, activityId);
    if (m[2] === "attempts" && method === "GET") return attemptsSummary(s, activityId);
    const list = state.questions
      .filter((q) => q.courseId === courseId && q.activityId === activityId)
      .sort((a, b) => a.order - b.order);
    if (method === "GET") return ok(list.map(s.teacher ? teacherView : studentView));
    if (method === "PUT") return putQuestions(req, s, activityId);
  }
  if (rest === "adaptive") {
    const s = await scope(courseId, "teacher", false);
    if (s instanceof NextResponse) return s;
    if (method === "GET") return dashboard(s);
    if (method === "PATCH") {
      const enabled = (await readJson(req))?.enabled;
      if (typeof enabled !== "boolean") return invalid({ enabled: "Укажите, включена ли адаптация" });
      if (enabled) state.disabled.delete(courseId);
      else state.disabled.add(courseId);
      return ok({ enabled });
    }
  }
  if ((m = /^adaptive\/students\/([^/]+)\/(skills\/([^/]+)|pin)$/.exec(rest)) && method === "PUT") {
    const s = await scope(courseId, "teacher", false);
    if (s instanceof NextResponse) return s;
    const userId = decodeURIComponent(m[1]);
    if (!studentsOf(s.course).some((u) => u.id === userId)) return fail(404, "Ученик не найден");
    return m[3] ? overrideSkill(req, s, userId, decodeURIComponent(m[3])) : pin(req, s, userId);
  }
  if (rest === "events" && method === "GET") {
    const s = await scope(courseId, "any", false);
    if (s instanceof NextResponse) return s;
    return events(url, s);
  }
  return fail(404, "not found");
}

// ---- события ученика ----

async function recordEvent(req: Request, s: Scope) {
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const type = text(body.type);
  if (type !== "activity.viewed" && type !== "activity.completed")
    return invalid({ type: "Этот тип события нельзя отправить с клиента" });
  const activityId = text(body.activityId);
  if (!materials(s.course).some((a) => a.id === activityId)) return fail(404, "Материал не найден");
  const coverage = body.coverage;
  if (
    coverage !== undefined &&
    (typeof coverage !== "number" || !Number.isFinite(coverage) || coverage < 0 || coverage > 100)
  )
    return invalid({ coverage: "Покрытие материала — от 0 до 100 процентов" });
  event({
    userId: s.actor.id,
    actorId: s.actor.id,
    courseId: s.course.id,
    type,
    payload: { coverage: coverage ?? null },
    activityId,
  });
  return noContent();
}

// ---- попытки ----

const myAttempts = (s: Scope, activityId: string) =>
  state.attempts.filter(
    (a) => a.courseId === s.course.id && a.activityId === activityId && a.userId === s.actor.id,
  );
const maxAttemptsOf = (s: Scope, activityId: string) =>
  materials(s.course).find((a) => a.id === activityId)?.maxAttempts;

/** Свои попытки теста — как Attempts в AdaptiveQuizEndpoints.cs */
function attemptsSummary(s: Scope, activityId: string) {
  const mine = myAttempts(s, activityId);
  const done = mine.filter((a) => a.submittedAt && a.max > 0);
  const summary: AttemptsSummary = {
    maxAttempts: maxAttemptsOf(s, activityId),
    used: done.length,
    open: mine.some((a) => !a.submittedAt),
    bestPercent: done.length
      ? Math.max(...done.map((a) => Math.round((100 * (a.score ?? 0)) / a.max)))
      : undefined,
  };
  return ok(summary);
}

function startAttempt(s: Scope, activityId: string) {
  const mine = myAttempts(s, activityId);
  const open = mine.find((a) => !a.submittedAt);
  if (open) return ok({ attemptId: open.id, questions: open.questions.map((x) => studentView(x.question)) });
  const limit = maxAttemptsOf(s, activityId);
  if (limit != null && mine.filter((a) => a.submittedAt).length >= limit)
    return fail(409, "Попытки закончились");
  const questions = state.questions
    .filter((q) => q.courseId === s.course.id && q.activityId === activityId)
    .sort((a, b) => a.order - b.order);
  if (!questions.length) return fail(409, "В тесте пока нет вопросов");
  const attempt: Attempt = {
    id: newId("at"),
    userId: s.actor.id,
    courseId: s.course.id,
    activityId,
    startedAt: new Date().toISOString(),
    max: questions.length,
    questions: questions.map((q) => ({
      question: structuredClone(q),
      skillIds: questionSkills(s.course, q),
    })),
    hintCounts: {},
    answers: {},
  };
  state.attempts.push(attempt);
  event({
    userId: s.actor.id,
    actorId: s.actor.id,
    courseId: s.course.id,
    type: "attempt.started",
    payload: { attemptId: attempt.id, max: attempt.max },
    activityId,
  });
  return ok({ attemptId: attempt.id, questions: questions.map(studentView) }, 201);
}

function isCorrect(q: StoredQuestion, given: unknown) {
  if (q.type === "short")
    return (
      typeof given === "string" && given.trim().toLowerCase().includes(String(q.correct).trim().toLowerCase())
    );
  return given === q.correct;
}

async function answer(req: Request, attempt: Attempt, s: Scope) {
  const body = await readJson(req);
  if (!body || !("given" in body)) return fail(400, "Некорректный запрос");
  const snapshot = attempt.questions.find((x) => x.question.id === text(body.questionId));
  if (!snapshot) return fail(404, "Вопрос не найден");
  const q = snapshot.question;
  if (attempt.answers[q.id]) return fail(409, "Ответ на этот вопрос уже сохранён");
  const given = body.given;
  const valid =
    q.type === "mcq"
      ? Number.isInteger(given) && (given as number) >= 0 && (given as number) < q.options.length
      : q.type === "boolean"
        ? typeof given === "boolean"
        : typeof given === "string";
  if (!valid) return invalid({ given: "Ответ не соответствует типу вопроса" });
  const correct = isCorrect(q, given);
  const hints = attempt.hintCounts[q.id] ?? 0;
  attempt.answers[q.id] = { given, isCorrect: correct, hintsUsed: hints };
  event({
    userId: attempt.userId,
    actorId: attempt.userId,
    courseId: attempt.courseId,
    type: "answer.submitted",
    payload: { attemptId: attempt.id, questionId: q.id, isCorrect: correct, hintsUsed: hints },
    activityId: attempt.activityId,
  });
  const section = s.course.sections?.find((x) => x.activities.some((a) => a.id === attempt.activityId));
  ensureSkills(s.course, section?.id);
  // модуль мог ещё не иметь авто-навыка на момент начала попытки
  const skillIds = snapshot.skillIds.length ? snapshot.skillIds : questionSkills(s.course, q);
  const skills = learn(attempt.userId, s.course, q, skillIds, correct, hints);
  return ok({ isCorrect: correct, correct: q.correct, skills });
}

async function hint(req: Request, attempt: Attempt) {
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const q = attempt.questions.find((x) => x.question.id === text(body.questionId))?.question;
  if (!q) return fail(404, "Вопрос не найден");
  if (attempt.answers[q.id]) return fail(409, "Ответ на этот вопрос уже сохранён");
  const previous = attempt.hintCounts[q.id] ?? 0;
  if (previous >= q.hints.length) return fail(409, "Подсказок больше нет");
  attempt.hintCounts[q.id] = previous + 1;
  event({
    userId: attempt.userId,
    actorId: attempt.userId,
    courseId: attempt.courseId,
    type: "hint.requested",
    payload: { attemptId: attempt.id, questionId: q.id, level: previous + 1 },
    activityId: attempt.activityId,
  });
  return ok({ level: previous + 1, text: q.hints[previous], hintsLeft: q.hints.length - previous - 1 });
}

function submit(attempt: Attempt) {
  if (!attempt.submittedAt) {
    attempt.score = Object.values(attempt.answers).filter((a) => a.isCorrect).length;
    attempt.submittedAt = new Date().toISOString();
    event({
      userId: attempt.userId,
      actorId: attempt.userId,
      courseId: attempt.courseId,
      type: "attempt.submitted",
      payload: { attemptId: attempt.id, score: attempt.score, max: attempt.max },
      activityId: attempt.activityId,
    });
  }
  const score = attempt.score ?? 0;
  return ok({ score, max: attempt.max, percent: attempt.max ? Math.round((100 * score) / attempt.max) : 0 });
}

// ---- навыки (преподаватель) ----

function skillErrors(body: Record<string, unknown>, course: Course, skillId: string | null) {
  const errors: Record<string, string> = {};
  const partial = skillId !== null;
  const title = text(body.title);
  if ((!partial || body.title !== undefined) && (title.length < 2 || title.length > 200))
    errors.title = "Название навыка — от 2 до 200 символов";
  if (text(body.code).length > 20) errors.code = "Код — до 20 символов";
  if (text(body.description).length > 1000) errors.description = "Описание — до 1000 символов";
  const sectionId = optional(body.sectionId);
  if (sectionId && !course.sections?.some((s) => s.id === sectionId)) errors.sectionId = "Такого модуля нет";
  const prerequisites = Array.isArray(body.prerequisiteIds) ? body.prerequisiteIds.map(String) : [];
  const ids = new Set(state.skills.filter((s) => s.courseId === course.id).map((s) => s.id));
  if (
    body.prerequisiteIds !== undefined &&
    (!Array.isArray(body.prerequisiteIds) || prerequisites.some((id) => !ids.has(id)))
  )
    errors.prerequisiteIds = "Пререквизит должен быть навыком этого курса";
  else if (skillId && createsCycle(skillId, prerequisites))
    errors.prerequisiteIds = "Пререквизиты не должны образовывать цикл";
  return { errors, prerequisites };
}

/** Цикл: от одного из новых пререквизитов по цепочке можно вернуться к самому навыку */
function createsCycle(skillId: string, prerequisites: string[]) {
  const seen = new Set<string>();
  const stack = [...prerequisites];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === skillId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...state.prerequisites.filter((p) => p.skillId === id).map((p) => p.requiresSkillId));
  }
  return false;
}

const info = (course: Course, id: string) => skillInfos(course, false).find((s) => s.id === id);

async function createSkill(req: Request, s: Scope) {
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const { errors, prerequisites } = skillErrors(body, s.course, null);
  if (Object.keys(errors).length) return invalid(errors);
  const all = state.skills.filter((x) => x.courseId === s.course.id);
  const skill: StoredSkill = {
    id: newId("sk"),
    courseId: s.course.id,
    sectionId: optional(body.sectionId),
    code: optional(body.code),
    title: text(body.title),
    description: optional(body.description),
    order: all.length ? Math.max(...all.map((x) => x.order)) + 1 : 1,
    isAuto: false,
    pInit: 0.3,
    pLearn: 0.15,
    pSlip: 0.1,
    pGuess: 0.2,
  };
  state.skills.push(skill);
  state.prerequisites.push(...prerequisites.map((r) => ({ skillId: skill.id, requiresSkillId: r })));
  return ok(info(s.course, skill.id), 201);
}

async function patchSkill(req: Request, s: Scope, skill: StoredSkill) {
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const { errors, prerequisites } = skillErrors(body, s.course, skill.id);
  if (Object.keys(errors).length) return invalid(errors);
  if (body.title !== undefined) skill.title = text(body.title);
  if (body.code !== undefined) skill.code = optional(body.code);
  if (body.description !== undefined) skill.description = optional(body.description);
  if (body.sectionId !== undefined) skill.sectionId = optional(body.sectionId);
  if (body.prerequisiteIds !== undefined) {
    state.prerequisites = state.prerequisites.filter((p) => p.skillId !== skill.id);
    state.prerequisites.push(...prerequisites.map((r) => ({ skillId: skill.id, requiresSkillId: r })));
  }
  return ok(info(s.course, skill.id));
}

function deleteSkill(skill: StoredSkill) {
  if ([...state.mastery.values()].some((m) => m.skillId === skill.id))
    return fail(409, "По навыку уже есть результаты учеников");
  state.skills = state.skills.filter((x) => x.id !== skill.id);
  state.prerequisites = state.prerequisites.filter(
    (p) => p.skillId !== skill.id && p.requiresSkillId !== skill.id,
  );
  state.links = state.links.filter((l) => l.skillId !== skill.id);
  for (const q of state.questions) if (q.skillId === skill.id) q.skillId = null;
  return noContent();
}

/** «ОПК-1.2 Уметь …» → код и название; по навыку на строку */
async function importSkills(req: Request, s: Scope) {
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const lines = String(body.text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 50) return invalid({ text: "Не больше 50 навыков за раз" });
  const sectionId = optional(body.sectionId);
  if (sectionId && !s.course.sections?.some((x) => x.id === sectionId))
    return invalid({ sectionId: "Такого модуля нет" });
  const created: string[] = [];
  const errors: Record<string, string> = {};
  const parsed = lines.map((line, i) => {
    const m = /^([A-ZА-ЯЁ]{1,6}-?\d+(?:\.\d+)*)\s+(.+)$/u.exec(line);
    const code = m?.[1] ?? null;
    const title = (m?.[2] ?? line).trim();
    if (title.length < 2 || title.length > 200)
      errors[`lines.${i}`] = "Название навыка — от 2 до 200 символов";
    if (code && code.length > 20) errors[`lines.${i}`] = "Код — до 20 символов";
    return { code, title };
  });
  if (Object.keys(errors).length) return invalid(errors);
  for (const p of parsed) {
    const all = state.skills.filter((x) => x.courseId === s.course.id);
    const skill: StoredSkill = {
      id: newId("sk"),
      courseId: s.course.id,
      sectionId,
      code: p.code,
      title: p.title,
      description: null,
      order: all.length ? Math.max(...all.map((x) => x.order)) + 1 : 1,
      isAuto: false,
      pInit: 0.3,
      pLearn: 0.15,
      pSlip: 0.1,
      pGuess: 0.2,
    };
    state.skills.push(skill);
    created.push(skill.id);
  }
  const infos = skillInfos(s.course, false);
  return ok(
    created.map((id) => infos.find((x) => x.id === id)),
    201,
  );
}

async function linkSkills(req: Request, s: Scope, activityId: string) {
  if (!materials(s.course).some((a) => a.id === activityId)) return fail(404, "Материал не найден");
  const body = await readJson(req);
  if (!body || !Array.isArray(body.skillIds)) return fail(400, "Некорректный запрос");
  const ids = [...new Set(body.skillIds.map(String))];
  const own = new Set(state.skills.filter((x) => x.courseId === s.course.id).map((x) => x.id));
  if (ids.some((id) => !own.has(id))) return invalid({ skillIds: "Навык должен быть из этого курса" });
  state.links = state.links.filter((l) => !(l.courseId === s.course.id && l.activityId === activityId));
  state.links.push(...ids.map((skillId) => ({ courseId: s.course.id, activityId, skillId })));
  return ok({ activityId, skillIds: ids });
}

// ---- вопросы (преподаватель) ----

async function putQuestions(req: Request, s: Scope, activityId: string) {
  const raw = await readJson(req).catch(() => null);
  const list = Array.isArray(raw?.questions) ? (raw!.questions as unknown[]) : null;
  if (!list) return fail(400, "Некорректный запрос");
  const own = new Set(state.skills.filter((x) => x.courseId === s.course.id).map((x) => x.id));
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  const parsed: StoredQuestion[] = list.map((item, index) => {
    const p = `questions.${index}.`;
    const q = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const type = q.type as StoredQuestion["type"];
    if (!["mcq", "short", "boolean"].includes(type)) errors[p + "type"] = "Неизвестный тип вопроса";
    const body = text(q.text);
    if (body.length < 1 || body.length > 2000) errors[p + "text"] = "Текст вопроса — до 2000 символов";
    const options = Array.isArray(q.options) ? q.options.map((o) => text(o)) : [];
    const validOptions = options.length >= 2 && options.length <= 8 && options.every(Boolean);
    if (type === "mcq" && !validOptions) errors[p + "options"] = "У вопроса с выбором — от 2 до 8 вариантов";
    const correct = q.correct;
    const validCorrect =
      type === "mcq"
        ? Number.isInteger(correct) && (correct as number) >= 0 && (correct as number) < options.length
        : type === "short"
          ? typeof correct === "string" && correct.trim().length > 0
          : typeof correct === "boolean";
    if (!validCorrect) errors[p + "correct"] = "Укажите правильный ответ";
    const hints = Array.isArray(q.hints) ? q.hints : [];
    if (
      !Array.isArray(q.hints ?? []) ||
      hints.length > 3 ||
      hints.some((h) => typeof h !== "string" || h.length > 500)
    )
      errors[p + "hints"] = "Не больше 3 подсказок до 500 символов";
    const skillId = optional(q.skillId);
    if (skillId && !own.has(skillId)) errors[p + "skillId"] = "Навык должен быть из этого курса";
    const id = text(q.id) || newId("q");
    if (id.length > 100 || seen.has(id)) errors[p + "id"] = "Идентификаторы вопросов должны быть уникальными";
    seen.add(id);
    return {
      id,
      courseId: s.course.id,
      activityId,
      type,
      text: body,
      options: type === "mcq" ? options : [],
      correct: typeof correct === "string" ? correct.trim() : (correct as number | boolean),
      hints: hints.map((h) => String(h).trim()).filter(Boolean),
      skillId,
      order: index + 1,
    };
  });
  if (Object.keys(errors).length) return invalid(errors);
  state.questions = state.questions
    .filter((q) => !(q.courseId === s.course.id && q.activityId === activityId))
    .concat(parsed);
  return ok(parsed.map(teacherView));
}

// ---- контроль преподавателя ----

function dashboard(s: Scope) {
  const skills = ensureSkills(s.course);
  const students = studentsOf(s.course).map((u) => {
    const rows = masteries(u.id, skills);
    const pinRow = state.pins.find((p) => p.userId === u.id && p.courseId === s.course.id);
    return {
      id: u.id,
      name: u.name,
      progress: progress(s.course, u.id).progress,
      skills: Object.fromEntries(
        [...rows.entries()].map(([id, r]) => [
          id,
          { pKnown: r.pKnown, status: r.status, unlockedByTeacher: r.unlockedByTeacher },
        ]),
      ),
      ...(pinRow && { pin: pinRow }),
    };
  });
  return ok({ enabled: !state.disabled.has(s.course.id), skills: skillInfos(s.course), students });
}

async function overrideSkill(req: Request, s: Scope, userId: string, skillId: string) {
  const skill = state.skills.find((x) => x.id === skillId && x.courseId === s.course.id);
  if (!skill) return fail(404, "Навык не найден");
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const errors: Record<string, string> = {};
  const reason = text(body.reason);
  if (reason.length < 3 || reason.length > 500) errors.reason = "Укажите причину — от 3 до 500 символов";
  const action = text(body.action);
  if (!["master", "reset", "unlock"].includes(action)) errors.action = "Неизвестное действие";
  if (Object.keys(errors).length) return invalid(errors);
  const skills = state.skills.filter((x) => x.courseId === s.course.id);
  const row = masteries(userId, skills).get(skillId)!;
  const wasMastered = row.status === "mastered";
  if (action === "master")
    Object.assign(row, {
      pKnown: 1,
      status: "mastered",
      masteredAt: row.masteredAt ?? new Date().toISOString(),
    });
  if (action === "reset")
    Object.assign(row, {
      pKnown: skill.pInit,
      attempts: 0,
      correct: 0,
      status: "learning",
      unlockedByTeacher: false,
      masteredAt: undefined,
    });
  if (action === "unlock")
    Object.assign(row, {
      unlockedByTeacher: true,
      status: row.status === "mastered" ? "mastered" : "learning",
    });
  row.updatedAt = new Date().toISOString();
  saveMastery(row);
  if (action === "master" && !wasMastered)
    event({
      userId,
      actorId: s.actor.id,
      courseId: s.course.id,
      type: "skill.mastered",
      payload: { pKnown: row.pKnown },
      skillId,
    });
  override(userId, s.actor.id, s.course.id, action, reason, { skillId });
  // статус «сброшенного» навыка пересчитывается по пререквизитам
  return ok(masteries(userId, skills).get(skillId));
}

async function pin(req: Request, s: Scope, userId: string) {
  const body = await readJson(req);
  if (!body || !("activityId" in body)) return fail(400, "Некорректный запрос");
  const errors: Record<string, string> = {};
  const reason = text(body.reason);
  if (reason.length < 3 || reason.length > 500) errors.reason = "Укажите причину — от 3 до 500 символов";
  const activityId = optional(body.activityId);
  if (activityId && !materials(s.course).some((a) => a.id === activityId))
    errors.activityId = "Материал должен быть из этого курса";
  if (Object.keys(errors).length) return invalid(errors);
  state.pins = state.pins.filter((p) => !(p.userId === userId && p.courseId === s.course.id));
  const row = activityId
    ? {
        userId,
        courseId: s.course.id,
        activityId,
        reason,
        createdBy: s.actor.id,
        createdAt: new Date().toISOString(),
      }
    : null;
  if (row) state.pins.push(row);
  override(userId, s.actor.id, s.course.id, activityId ? "pin" : "unpin", reason, { activityId });
  return row ? ok(row) : noContent();
}

function events(url: URL, s: Scope) {
  let userId = url.searchParams.get("userId") ?? "";
  if (!s.teacher) {
    if (userId && userId !== s.actor.id) return fail(403, "Недостаточно прав");
    userId = s.actor.id;
  } else if (userId && !studentsOf(s.course).some((u) => u.id === userId))
    return fail(404, "Ученик не найден");
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? 100 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1)
    return invalid({ limit: "Лимит должен быть положительным числом" });
  const type = url.searchParams.get("type") ?? "";
  return ok(
    state.events
      .filter(
        (e) => e.courseId === s.course.id && (!userId || e.userId === userId) && (!type || e.type === type),
      )
      .slice()
      .reverse()
      .slice(0, Math.min(limit, 500)),
  );
}
