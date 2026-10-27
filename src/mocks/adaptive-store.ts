import "server-only";
import { quizQuestions, users } from "@/mocks/data";
import { findDemoCourse } from "@/mocks/course-store";
import type {
  Activity,
  AdaptiveNext,
  AdaptiveProgress,
  AdaptiveQuestion,
  Course,
  ReasonCode,
  Skill,
  SkillChange,
  SkillStatus,
} from "@/shared/types/domain";

// Адаптивное обучение в демо-режиме — та же логика, что Adaptive/AdaptiveEngine.cs:
// навыки курса, BKT, статусы по пререквизитам, прогресс и выбор следующего задания.
// Состояние живёт на globalThis (переживает HMR) и сбрасывается при перезапуске сервера.

type StoredSkill = Omit<Skill, "prerequisiteIds" | "activityIds">;
type StoredQuestion = AdaptiveQuestion & {
  courseId: string;
  activityId: string;
  correct: number | string | boolean;
  hints: string[];
};

export interface Mastery {
  userId: string;
  skillId: string;
  pKnown: number;
  attempts: number;
  correct: number;
  status: SkillStatus;
  unlockedByTeacher: boolean;
  masteredAt?: string;
  updatedAt: string;
}

interface AttemptAnswer {
  given: unknown;
  isCorrect: boolean;
  hintsUsed: number;
}

export interface Attempt {
  id: string;
  userId: string;
  courseId: string;
  activityId: string;
  startedAt: string;
  submittedAt?: string;
  score?: number;
  max: number;
  /** снимок вопросов на момент начала: правка теста не меняет начатую попытку */
  questions: { question: StoredQuestion; skillIds: string[] }[];
  hintCounts: Record<string, number>;
  answers: Record<string, AttemptAnswer>;
}

export interface Recommendation {
  id: string;
  userId: string;
  courseId: string;
  activityId?: string | null;
  skillId?: string | null;
  reasonCode: ReasonCode;
  reasonText: string;
  status: "shown" | "accepted" | "skipped" | "overridden";
  createdAt: string;
}

export interface Pin {
  userId: string;
  courseId: string;
  activityId: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface LearningEvent {
  id: number;
  at: string;
  userId: string;
  actorId: string;
  courseId: string;
  activityId?: string | null;
  skillId?: string | null;
  type: string;
  payload: Record<string, unknown>;
}

interface State {
  skills: StoredSkill[];
  prerequisites: { skillId: string; requiresSkillId: string }[];
  links: { courseId: string; activityId: string; skillId: string }[];
  questions: StoredQuestion[];
  attempts: Attempt[];
  mastery: Map<string, Mastery>;
  recommendations: Recommendation[];
  pins: Pin[];
  events: LearningEvent[];
  disabled: Set<string>;
  seq: number;
}

const g = globalThis as unknown as { __helios_adaptive?: State };
const state: State = g.__helios_adaptive ?? (g.__helios_adaptive = seed());

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
const now = () => new Date().toISOString();
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const masteryKey = (userId: string, skillId: string) => `${userId}/${skillId}`;

// ---- сид: как Adaptive/AdaptiveSeed.cs (курс c-dor-ai, модуль s1) ----
function seed(): State {
  const s: State = {
    skills: [],
    prerequisites: [],
    links: [],
    questions: [],
    attempts: [],
    mastery: new Map(),
    recommendations: [],
    pins: [],
    events: [],
    disabled: new Set(),
    seq: 0,
  };
  const courseId = "c-dor-ai";
  const ids = ["sk-dor-types", "sk-ai-tools", "sk-dor-quality", "sk-dor-build"];
  const titles = [
    "Различать виды цифровых образовательных ресурсов",
    "Применять инструменты генеративного ИИ",
    "Оценивать качество цифрового образовательного ресурса",
    "Создавать интерактивный образовательный ресурс",
  ];
  const materials = ["mv1", "mp1", "md1", "ma1"];
  ids.forEach((id, i) => {
    s.skills.push({
      id,
      courseId,
      sectionId: "s1",
      code: `ОПК-1.${i + 1}`,
      title: titles[i],
      description: null,
      order: i + 1,
      isAuto: false,
      pInit: 0.3,
      pLearn: 0.15,
      pSlip: 0.1,
      pGuess: 0.2,
    });
    s.links.push({ courseId, activityId: materials[i], skillId: id });
  });
  s.prerequisites.push(
    { skillId: ids[1], requiresSkillId: ids[0] },
    { skillId: ids[2], requiresSkillId: ids[0] },
    { skillId: ids[3], requiresSkillId: ids[1] },
    { skillId: ids[3], requiresSkillId: ids[2] },
  );
  const q = (
    n: number,
    skill: number,
    type: StoredQuestion["type"],
    text: string,
    options: string[],
    correct: StoredQuestion["correct"],
    ...hints: string[]
  ) =>
    s.questions.push({
      id: `mq1q${n}`,
      courseId,
      activityId: "mq1",
      skillId: ids[skill],
      type,
      text,
      options,
      correct,
      hints,
      order: n,
    });
  q(
    1,
    0,
    "mcq",
    "Что из перечисленного — цифровой образовательный ресурс?",
    ["Интерактивный тренажёр", "Бумажный учебник", "Меловая доска", "Устный опрос"],
    0,
    "Ищите ресурс, работающий в цифровой среде.",
    "Он позволяет ученику выполнять задания и получать обратную связь.",
  );
  q(
    2,
    2,
    "boolean",
    "Материалы, созданные генеративным ИИ, нужно проверять на фактические ошибки перед публикацией.",
    [],
    true,
    "Нейросеть может уверенно сообщать неверные сведения.",
    "Преподаватель отвечает за точность опубликованного материала.",
  );
  q(
    3,
    1,
    "short",
    "Как называется текстовый запрос к генеративной нейросети?",
    [],
    "промпт",
    "Этот запрос описывает задачу и ожидаемый результат.",
    "Термин начинается с «пром» и заимствован из английского prompt.",
  );
  q(
    4,
    0,
    "boolean",
    "Цифровой образовательный ресурс может содержать интерактивные задания.",
    [],
    true,
    "В цифровой среде можно обрабатывать действия ученика.",
    "Тренажёр с проверкой ответа — пример такого ресурса.",
  );
  q(
    5,
    0,
    "mcq",
    "Какой ресурс лучше подходит для самостоятельной отработки навыка с обратной связью?",
    ["Список литературы", "Интерактивный тренажёр", "Фотография аудитории"],
    1,
    "Ученик должен иметь возможность проверить свои действия.",
    "Нужен ресурс, который реагирует на ответы ученика.",
  );
  q(
    6,
    1,
    "mcq",
    "Что полезно включить в запрос к ИИ для подготовки учебного материала?",
    ["Только слово «сделай»", "Цель, аудиторию и формат результата", "Случайный набор слов"],
    1,
    "Нейросети нужен контекст задачи.",
    "Опишите, чему учить, кого учить и в каком виде нужен результат.",
  );
  q(
    7,
    1,
    "boolean",
    "Результат генерации можно уточнять дополнительными запросами.",
    [],
    true,
    "Первый ответ может не соответствовать всем требованиям.",
    "Уточнение запроса позволяет исправить и дополнить результат.",
  );
  q(
    8,
    2,
    "mcq",
    "Что следует сделать перед публикацией созданного ИИ учебного текста?",
    ["Проверить факты и соответствие учебной цели", "Удалить все источники", "Сразу отправить ученикам"],
    0,
    "Красивое оформление не гарантирует правильность содержания.",
    "Сверьте сведения с надёжными источниками и задачами обучения.",
  );
  q(
    9,
    2,
    "boolean",
    "Проверка доступности материала для учеников входит в оценку качества ЦОР.",
    [],
    true,
    "Материал должен быть пригоден для целевой аудитории.",
    "Проверьте читаемость, навигацию, субтитры и альтернативные описания.",
  );
  q(
    10,
    3,
    "mcq",
    "С чего следует начинать разработку интерактивного учебного ресурса?",
    [
      "Со случайного выбора эффектов",
      "С определения учебной цели и сценария",
      "С публикации незавершённого шаблона",
    ],
    1,
    "Сначала определите ожидаемый результат обучения.",
    "Цель и действия ученика задают структуру будущего ресурса.",
  );
  q(
    11,
    3,
    "boolean",
    "Перед использованием тренажёра следует проверить задания и обратную связь на типичных ответах.",
    [],
    true,
    "Рабочая кнопка ещё не означает, что тренажёр обучает правильно.",
    "Пройдите сценарии с верными, неверными и пустыми ответами.",
  );
  q(
    12,
    3,
    "short",
    "Как называется реакция тренажёра на ответ ученика, помогающая понять ошибку?",
    [],
    "обратная связь",
    "Ученик должен узнать, что получилось и что нужно исправить.",
    "Это два слова: первое — «обратная».",
  );
  // освоение у одногруппников — чтобы панели преподавателя было что показать (текущий ученик начинает с нуля)
  const base = [0.97, 0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.36];
  users
    .filter((u) => u.role === "student" && u.group === "М1227" && u.id !== "u-stud-2")
    .forEach((u, n) =>
      ids.forEach((skillId, i) => {
        const p = Math.max(0.3, Math.min(0.99, base[n % base.length] - i * 0.12));
        s.mastery.set(`${u.id}/${skillId}`, {
          userId: u.id,
          skillId,
          pKnown: Math.round(p * 10000) / 10000,
          attempts: 3 + i,
          correct: Math.round((3 + i) * p),
          status: p >= 0.95 ? "mastered" : "learning",
          unlockedByTeacher: false,
          masteredAt: p >= 0.95 ? new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString(),
        });
      }),
    );
  // тест «основные понятия ИИ» — без подсказок и навыков: работает авто-навык модуля
  (quizQuestions.a3 ?? []).forEach((x, i) =>
    s.questions.push({
      id: x.id,
      courseId: "c-ai-teaching",
      activityId: "a3",
      type: x.type,
      text: x.text,
      options: x.options ?? [],
      correct: x.correct ?? "",
      hints: [],
      skillId: null,
      order: i + 1,
    }),
  );
  return s;
}

// ---- материалы и навыки ----

export function materials(course: Course): Activity[] {
  return [...(course.sections ?? [])].sort((a, b) => a.order - b.order).flatMap((s) => s.activities);
}

export function event(
  e: Omit<LearningEvent, "id" | "at" | "activityId" | "skillId"> & {
    activityId?: string | null;
    skillId?: string | null;
  },
) {
  state.events.push({ ...e, id: ++state.seq, at: now() });
}

/** Навыки курса; модулю без навыков лениво создаётся авто-навык с названием модуля */
export function ensureSkills(course: Course, sectionId?: string): StoredSkill[] {
  const skills = state.skills.filter((s) => s.courseId === course.id);
  for (const section of [...(course.sections ?? [])].sort((a, b) => a.order - b.order)) {
    if (sectionId && section.id !== sectionId) continue;
    if (skills.some((s) => s.sectionId === section.id)) continue;
    const skill: StoredSkill = {
      id: newId("sk"),
      courseId: course.id,
      sectionId: section.id,
      code: null,
      title: section.title.slice(0, 200),
      description: null,
      order: skills.length ? Math.max(...skills.map((s) => s.order)) + 1 : 1,
      isAuto: true,
      pInit: 0.3,
      pLearn: 0.15,
      pSlip: 0.1,
      pGuess: 0.2,
    };
    skills.push(skill);
    state.skills.push(skill);
  }
  return skills.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function skillInfos(course: Course, ensureAuto = true): Skill[] {
  const skills = ensureAuto
    ? ensureSkills(course)
    : state.skills.filter((s) => s.courseId === course.id).sort((a, b) => a.order - b.order);
  return skills.map((s) => ({
    ...s,
    prerequisiteIds: state.prerequisites
      .filter((p) => p.skillId === s.id)
      .map((p) => p.requiresSkillId)
      .sort(),
    activityIds: state.links
      .filter((l) => l.courseId === course.id && l.skillId === s.id)
      .map((l) => l.activityId)
      .sort(),
  }));
}

export function materialSkills(course: Course, activityId: string): string[] {
  const explicit = [
    ...new Set(
      state.links
        .filter((l) => l.courseId === course.id && l.activityId === activityId)
        .map((l) => l.skillId),
    ),
  ];
  if (explicit.length) return explicit;
  const section = course.sections?.find((s) => s.activities.some((a) => a.id === activityId));
  return section
    ? state.skills.filter((s) => s.courseId === course.id && s.sectionId === section.id).map((s) => s.id)
    : [];
}

export function questionSkills(course: Course, q: StoredQuestion): string[] {
  return q.skillId ? [q.skillId] : materialSkills(course, q.activityId);
}

// ---- модель ученика ----

/** Освоение навыков ученика; нет записи — начальное состояние без сохранения */
export function masteries(userId: string, skills: StoredSkill[]): Map<string, Mastery> {
  const rows = new Map<string, Mastery>();
  for (const s of skills)
    rows.set(
      s.id,
      state.mastery.get(masteryKey(userId, s.id)) ?? {
        userId,
        skillId: s.id,
        pKnown: s.pInit,
        attempts: 0,
        correct: 0,
        status: "learning",
        unlockedByTeacher: false,
        updatedAt: now(),
      },
    );
  for (const row of rows.values()) {
    if (row.status === "mastered") continue;
    const ready =
      row.unlockedByTeacher ||
      state.prerequisites
        .filter((p) => p.skillId === row.skillId)
        .every((p) => rows.get(p.requiresSkillId)?.status === "mastered");
    row.status = ready ? "learning" : "locked";
  }
  return rows;
}

export const saveMastery = (row: Mastery) => state.mastery.set(masteryKey(row.userId, row.skillId), row);

/** BKT (как в Cognitive Tutor): ответ с подсказкой считается как ошибка */
export function bkt(
  p: number,
  skill: StoredSkill,
  q: Pick<StoredQuestion, "type" | "options">,
  correct: boolean,
  hints: number,
) {
  const guess =
    q.type === "mcq"
      ? 1 / q.options.length
      : q.type === "boolean"
        ? 0.5
        : q.type === "short"
          ? 0.05
          : skill.pGuess;
  const positive = correct && hints === 0;
  const numerator = p * (positive ? 1 - skill.pSlip : skill.pSlip);
  const denominator = numerator + (1 - p) * (positive ? guess : 1 - guess);
  const posterior = denominator === 0 ? p : numerator / denominator;
  return round4(Math.min(1, Math.max(0, posterior + (1 - posterior) * skill.pLearn)));
}

export function learn(
  userId: string,
  course: Course,
  q: StoredQuestion,
  skillIds: string[],
  correct: boolean,
  hints: number,
): SkillChange[] {
  const skills = state.skills.filter((s) => s.courseId === course.id);
  const rows = masteries(userId, skills);
  const changes: SkillChange[] = [];
  for (const skill of skills.filter((s) => skillIds.includes(s.id))) {
    const row = rows.get(skill.id)!;
    const before = row.pKnown;
    const wasMastered = row.status === "mastered";
    row.pKnown = bkt(before, skill, q, correct, hints);
    row.attempts++;
    if (correct) row.correct++;
    row.updatedAt = now();
    if (row.pKnown >= 0.95 || wasMastered) {
      row.status = "mastered";
      row.masteredAt ??= row.updatedAt;
    }
    saveMastery(row);
    event({
      userId,
      actorId: userId,
      courseId: course.id,
      type: "skill.updated",
      payload: { before, after: row.pKnown },
      activityId: q.activityId,
      skillId: skill.id,
    });
    if (!wasMastered && row.status === "mastered")
      event({
        userId,
        actorId: userId,
        courseId: course.id,
        type: "skill.mastered",
        payload: { pKnown: row.pKnown },
        activityId: q.activityId,
        skillId: skill.id,
      });
    changes.push({ skillId: skill.id, before, after: row.pKnown, status: row.status });
  }
  // освоение навыка открывает зависимые
  const refreshed = masteries(userId, skills);
  return changes.map((c) => ({ ...c, status: refreshed.get(c.skillId)!.status }));
}

export function completed(userId: string, courseId: string): Set<string> {
  const done = new Set(
    state.events
      .filter((e) => e.userId === userId && e.courseId === courseId && e.type === "activity.completed")
      .map((e) => e.activityId!),
  );
  for (const a of state.attempts)
    if (a.userId === userId && a.courseId === courseId && a.submittedAt) done.add(a.activityId);
  return done;
}

export function progress(course: Course, userId: string): AdaptiveProgress {
  const skills = ensureSkills(course);
  const rows = masteries(userId, skills);
  const list = materials(course);
  const done = completed(userId, course.id);
  const doneCount = list.filter((a) => done.has(a.id)).length;
  const materialShare = list.length ? doneCount / list.length : 0;
  const skillShare = skills.length
    ? [...rows.values()].filter((r) => r.status === "mastered").length / skills.length
    : 0;
  const hasQuiz = list.some((a) => a.type === "quiz");
  return {
    progress: Math.round(100 * (hasQuiz ? 0.7 * skillShare + 0.3 * materialShare : materialShare)),
    skills: skills.map((s) => ({
      id: s.id,
      title: s.title,
      code: s.code,
      pKnown: rows.get(s.id)!.pKnown,
      status: rows.get(s.id)!.status,
    })),
    materials: { done: doneCount, total: list.length },
  };
}

/** Решение преподавателя важнее алгоритма: текущая рекомендация ученика снимается */
export function override(
  userId: string,
  actorId: string,
  courseId: string,
  action: string,
  reason: string,
  ref: { activityId?: string | null; skillId?: string | null } = {},
) {
  for (const r of state.recommendations)
    if (r.userId === userId && r.courseId === courseId && r.status === "shown") r.status = "overridden";
  event({ userId, actorId, courseId, type: "teacher.override", payload: { action, reason }, ...ref });
}

const percent = (p: number) => Math.round(p * 100);
const REVIEW_TYPES = new Set(["video", "pdf", "presentation"]);

/** Следующее задание — правила раздела 2.4: закреп → линейный порядок → слабый навык → повторение → всё освоено */
export function next(course: Course, userId: string): AdaptiveNext {
  const skills = ensureSkills(course);
  const rows = masteries(userId, skills);
  const list = materials(course);
  const done = completed(userId, course.id);
  const learning = skills
    .filter((s) => rows.get(s.id)!.status === "learning")
    .sort(
      (a, b) =>
        rows.get(a.id)!.pKnown - rows.get(b.id)!.pKnown || a.order - b.order || a.id.localeCompare(b.id),
    );
  const personal = learning
    .filter((s) => rows.get(s.id)!.pKnown < 0.6)
    .map((s) => ({
      skillId: s.id,
      activityIds: list
        .filter(
          (a) => REVIEW_TYPES.has(a.type) && !done.has(a.id) && materialSkills(course, a.id).includes(s.id),
        )
        .map((a) => a.id),
    }));

  let activityId: string | null = null;
  let skillId: string | null = null;
  let code: ReasonCode;
  let reason: string;
  const pin = state.pins.find((p) => p.userId === userId && p.courseId === course.id);
  if (pin && list.some((a) => a.id === pin.activityId)) {
    activityId = pin.activityId;
    code = "pinned_by_teacher";
    reason = `Задание назначил преподаватель: ${pin.reason}`;
  } else if (state.disabled.has(course.id)) {
    activityId = list.find((a) => !done.has(a.id))?.id ?? null;
    code = "linear_order";
    reason = "Следующий материал по порядку курса";
  } else if (skills.length && skills.every((s) => rows.get(s.id)!.status === "mastered")) {
    code = "all_mastered";
    reason = "Все навыки курса освоены";
  } else if (learning[0]) {
    const weakest = learning[0];
    skillId = weakest.id;
    const solved = new Set(
      state.attempts
        .filter((a) => a.userId === userId && a.courseId === course.id)
        .flatMap((a) =>
          Object.entries(a.answers)
            .filter(([, x]) => x.isCorrect)
            .map(([qid]) => `${a.activityId}/${qid}`),
        ),
    );
    const relevant = state.questions.filter(
      (q) => q.courseId === course.id && questionSkills(course, q).includes(weakest.id),
    );
    const candidate = list
      .filter((a) => a.type === "quiz")
      .map((a, position) => ({
        activity: a,
        position,
        count: relevant.filter((q) => q.activityId === a.id).length,
        correct: relevant.filter((q) => q.activityId === a.id && solved.has(`${a.id}/${q.id}`)).length,
      }))
      .filter((c) => c.count > 0 && c.correct < c.count)
      .sort((a, b) => b.count - a.count || a.correct - b.correct || a.position - b.position)[0];
    if (candidate) {
      activityId = candidate.activity.id;
      code = "weakest_skill";
      reason = `Навык «${weakest.title}» освоен на ${percent(rows.get(weakest.id)!.pKnown)}%, пререквизиты пройдены`;
    } else {
      const viewed = new Set(
        state.events
          .filter(
            (e) =>
              e.userId === userId &&
              e.courseId === course.id &&
              (e.type === "activity.viewed" || e.type === "activity.completed"),
          )
          .map((e) => e.activityId),
      );
      activityId =
        list.find(
          (a) =>
            REVIEW_TYPES.has(a.type) &&
            !viewed.has(a.id) &&
            !done.has(a.id) &&
            materialSkills(course, a.id).includes(weakest.id),
        )?.id ?? null;
      code = "review_material";
      reason = activityId
        ? `Повторите материал по навыку «${weakest.title}»`
        : `Для навыка «${weakest.title}» нет доступного материала для повторения`;
    }
  } else {
    code = "review_material";
    reason = "Нет доступных заданий: проверьте пререквизиты навыков";
  }

  // без дублей: показанная рекомендация на тот же материал возвращается как есть
  let last = state.recommendations.filter((r) => r.userId === userId && r.courseId === course.id).at(-1);
  if (!last || last.status !== "shown" || (last.activityId ?? null) !== activityId) {
    last = {
      id: newId("rec"),
      userId,
      courseId: course.id,
      activityId,
      skillId,
      reasonCode: code,
      reasonText: reason,
      status: "shown",
      createdAt: now(),
    };
    state.recommendations.push(last);
    event({
      userId,
      actorId: userId,
      courseId: course.id,
      type: "recommendation.shown",
      payload: { recommendationId: last.id, reason },
      activityId,
      skillId,
    });
  }
  return {
    recommendation: {
      id: last.id,
      activityId: last.activityId,
      skillId: last.skillId,
      reasonCode: last.reasonCode,
      reasonText: last.reasonText,
    },
    personal,
  };
}

/** Прямой доступ к состоянию — для маршрутов (src/mocks/adaptive-api.ts) */
export const adaptiveState = state;
export type { StoredQuestion, StoredSkill };
export const courseById = (id: string) => findDemoCourse(id);
