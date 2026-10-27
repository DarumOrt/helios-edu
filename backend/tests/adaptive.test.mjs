import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { promisify } from "node:util";
import { apiUrl, get, login } from "./client.mjs";

const exec = promisify(execFile);
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const sql = async (query) => {
  const { stdout } = await exec(
    "docker",
    [
      "compose",
      "--profile",
      "backend",
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "helios",
      "-d",
      "helios_edu",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      query,
    ],
    { timeout: 30_000 },
  );
  return stdout.trim();
};
const bkt = (p, correct, guess, hints = 0) => {
  const positive = correct && !hints;
  const numerator = p * (positive ? 0.9 : 0.1);
  const posterior = numerator / (numerator + (1 - p) * (positive ? guess : 1 - guess));
  return Math.round((posterior + (1 - posterior) * 0.15) * 10_000) / 10_000;
};

test("P5: навыки, BKT, попытки, рекомендации и ручные решения на отдельном курсе", async (t) => {
  const organizer = await login(apiUrl, "organizer@pspu.ru");
  const tutor = await login(apiUrl, "tutor@pspu.ru");
  const unique = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const send = (method, path, body, actor = tutor, client = true) =>
    fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        Cookie: actor.cookie,
        "Content-Type": "application/json",
        ...(client ? { "X-Helios-Client": "web" } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    });
  const expect = async (response, status, field, message) => {
    const body = response.status === 204 ? null : await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    if (field) assert.equal(body.fields[field], message);
    return body;
  };
  const read = async (path, actor = tutor) => expect(await get(apiUrl, path, actor.cookie), 200);
  const createAccount = async (suffix, role = "student") => {
    const result = await expect(
      await send(
        "POST",
        "/api/users",
        { name: `Адаптация ${suffix}`, email: `adaptive-${suffix}-${unique}@example.ru`, role },
        organizer,
      ),
      201,
    );
    return login(apiUrl, result.user.email, result.temporaryPassword);
  };
  const student = await createAccount("one");
  const other = await createAccount("two");
  const outsider = await createAccount("outside");
  const foreign = await createAccount("foreign", "tutor");
  const createCourse = async (owner = tutor) =>
    expect(
      await send(
        "POST",
        "/api/courses",
        {
          code: `${[...randomBytes(6)].map((byte) => String.fromCharCode(65 + (byte % 26))).join("")}-505`,
          title: `Адаптация ${unique}`,
          description: "Изолированный сценарий P5",
          category: "Проверки",
          tutorId: owner.user.id,
        },
        organizer,
      ),
      201,
    );
  const course = await createCourse();
  const foreignCourse = await createCourse(foreign);
  const root = `/api/courses/${course.id}`;
  t.after(async () => expect(await send("PATCH", root, { status: "draft" }, organizer), 200));
  const me = `/api/me/courses/${course.id}`;
  await expect(await send("PATCH", root, { status: "published" }, organizer), 200);
  // P1 пока не предоставляет API зачислений. В фикстуре используем строго Enrollments, не моки/группы.
  await sql(
    `INSERT INTO "Enrollments" ("AccountId", "CourseId") VALUES (${literal(student.user.id)}, ${literal(course.id)}), (${literal(other.user.id)}, ${literal(course.id)})`,
  );
  const section = await expect(await send("POST", `${root}/sections`, { title: "Основной модуль" }), 201);
  const autoSection = await expect(
    await send("POST", `${root}/sections`, { title: "Модуль без навыков" }),
    201,
  );
  const addMaterial = async (type, title) =>
    expect(
      await send("POST", `${root}/sections/${section.id}/activities`, {
        type,
        title,
        src: "/media/test.mp4",
        pages: 3,
      }),
      201,
    );
  const video = await addMaterial("video", "Видеоматериал навыка A");
  const pdf = await addMaterial("pdf", "Конспект навыка A");
  const quiz = await addMaterial("quiz", "Тест навыков");
  const bQuiz = await addMaterial("quiz", "Тест зависимого навыка");
  const assignment = await addMaterial("assignment", "Практическая работа");
  const skillsPath = `${root}/skills`;
  const questionsPath = `${root}/quizzes/${quiz.id}/questions`;
  const next = (actor = student) => read(`${me}/next`, actor);
  const progress = (actor = student) => read(`${me}/progress`, actor);
  const mastery = async (skill, actor = student) =>
    (await progress(actor)).skills.find((item) => item.id === skill.id);
  const override = async (skill, action, actor = student) =>
    expect(
      await send("PUT", `${root}/adaptive/students/${actor.user.id}/skills/${skill.id}`, {
        action,
        reason: "Проверено преподавателем",
      }),
      200,
    );
  const start = async (actor = student, activity = quiz) =>
    expect(await send("POST", `${root}/quizzes/${activity.id}/attempts`, {}, actor), 201);
  const answer = async (attempt, questionId, given, actor = student) =>
    expect(
      await send("POST", `/api/attempts/${attempt.attemptId}/answers`, { questionId, given }, actor),
      200,
    );
  const submit = async (attempt, actor = student) =>
    expect(await send("POST", `/api/attempts/${attempt.attemptId}/submit`, {}, actor), 200);
  let a, b, c, autoSkill, questions, firstAttempt;

  await t.test("навыки, права, точные ошибки, цикл и чужие привязки", async () => {
    await expect(
      await send("POST", skillsPath, { title: "A" }),
      400,
      "title",
      "Название навыка — от 2 до 200 символов",
    );
    a = await expect(
      await send("POST", skillsPath, { title: "Основной навык A", sectionId: section.id }),
      201,
    );
    b = await expect(
      await send("POST", skillsPath, {
        title: "Зависимый навык B",
        sectionId: section.id,
        prerequisiteIds: [a.id],
      }),
      201,
    );
    c = await expect(
      await send("POST", skillsPath, { title: "Дополнительный навык C", sectionId: section.id }),
      201,
    );
    assert.match(a.id, /^sk-[a-f0-9]{8}$/);
    await expect(
      await send("PATCH", `${skillsPath}/${a.id}`, { prerequisiteIds: [b.id] }),
      400,
      "prerequisiteIds",
      "Пререквизиты не должны образовывать цикл",
    );
    await expect(
      await send("PATCH", `${skillsPath}/${a.id}`, { prerequisiteIds: [a.id] }),
      400,
      "prerequisiteIds",
      "Пререквизиты не должны образовывать цикл",
    );
    await expect(
      await send("PATCH", `${skillsPath}/${a.id}`, { code: "a".repeat(21) }),
      400,
      "code",
      "Код — до 20 символов",
    );
    await expect(
      await send("PATCH", `${skillsPath}/${a.id}`, { description: "x".repeat(1001) }),
      400,
      "description",
      "Описание — до 1000 символов",
    );
    await expect(
      await send("PATCH", `${skillsPath}/${a.id}`, { sectionId: "missing" }),
      400,
      "sectionId",
      "Такого модуля нет",
    );
    const foreignSkill = await expect(
      await send("POST", `/api/courses/${foreignCourse.id}/skills`, { title: "Чужой навык" }, foreign),
      201,
    );
    await expect(
      await send("PATCH", `${skillsPath}/${a.id}`, { prerequisiteIds: [foreignSkill.id] }),
      400,
      "prerequisiteIds",
      "Пререквизит должен быть навыком этого курса",
    );
    await expect(
      await send("PUT", `${root}/activities/${video.id}/skills`, { skillIds: [foreignSkill.id] }),
      400,
      "skillIds",
      "Навык должен быть из этого курса",
    );
    await expect(await send("POST", skillsPath, { title: "Попытка ученика" }, student), 403);
    await expect(
      await send("PATCH", `${skillsPath}/${a.id}`, { title: "Чужой преподаватель" }, foreign),
      404,
    );
    assert.equal((await get(apiUrl, skillsPath, foreign.cookie)).status, 404);
    assert.equal((await get(apiUrl, skillsPath)).status, 401);
    await expect(await send("POST", skillsPath, { title: "Без заголовка" }, tutor, false), 403);
    await expect(await send("PUT", `${root}/activities/${video.id}/skills`, { skillIds: [a.id] }), 200);
    await expect(await send("PUT", `${root}/activities/${pdf.id}/skills`, { skillIds: [a.id] }), 200);
  });

  await t.test("импорт кодов и сохранение авто-навыка после добавления ручного", async () => {
    const before = await read(skillsPath);
    autoSkill = before.find((item) => item.sectionId === autoSection.id);
    assert.equal(autoSkill.isAuto, true);
    assert.equal(autoSkill.title, autoSection.title);
    const imported = await expect(
      await send("POST", `${skillsPath}/import`, {
        text: "ОПК-1.1 Уметь читать\n\nОПК-1.2 Уметь писать\nОПК-1.3 Уметь проверять",
        sectionId: autoSection.id,
      }),
      201,
    );
    assert.deepEqual(
      imported.map((item) => item.code),
      ["ОПК-1.1", "ОПК-1.2", "ОПК-1.3"],
    );
    assert.equal(
      (await read(skillsPath)).filter((item) => item.isAuto && item.sectionId === autoSection.id).length,
      1,
    );
    assert.ok((await read(skillsPath)).some((item) => item.id === autoSkill.id));
    await expect(
      await send("POST", `${skillsPath}/import`, { text: Array(51).fill("Лишняя строка").join("\n") }),
      400,
    );
  });

  await t.test("вопросы: типы, отсутствие утечек, поля и привязка к курсу", async () => {
    questions = [
      {
        id: "q-a",
        type: "mcq",
        text: "Правильный вариант?",
        options: ["Да", "Нет"],
        correct: 0,
        skillId: a.id,
        hints: ["Первая подсказка", "Вторая подсказка"],
      },
      {
        id: "q-wrong",
        type: "boolean",
        text: "Утверждение верно?",
        correct: true,
        skillId: a.id,
        hints: ["Подумайте"],
      },
      {
        id: "q-hint",
        type: "mcq",
        text: "С подсказкой?",
        options: ["Да", "Нет", "Не знаю"],
        correct: 0,
        skillId: a.id,
        hints: ["Ответ — первый"],
      },
      {
        id: "q-short",
        type: "short",
        text: "Как называется запрос?",
        correct: "промпт",
        skillId: a.id,
        hints: [],
      },
      { id: "q-fallback", type: "boolean", text: "Привязка к материалу?", correct: true, hints: [] },
      { id: "q-section", type: "boolean", text: "Навыки модуля?", correct: true, hints: [] },
    ];
    await expect(
      await send("PUT", questionsPath, [{ ...questions[0], options: ["Один"] }]),
      400,
      "questions.0.options",
      "У вопроса с выбором — от 2 до 8 вариантов",
    );
    await expect(
      await send("PUT", questionsPath, [{ ...questions[0], correct: 8 }]),
      400,
      "questions.0.correct",
      "Укажите правильный ответ",
    );
    await expect(
      await send("PUT", questionsPath, [{ ...questions[0], hints: ["x".repeat(501)] }]),
      400,
      "questions.0.hints",
      "Не больше 3 подсказок до 500 символов",
    );
    await expect(
      await send("PUT", questionsPath, [{ ...questions[0], text: "" }]),
      400,
      "questions.0.text",
      "Текст вопроса — до 2000 символов",
    );
    await expect(
      await send("PUT", `${root}/quizzes/${video.id}/questions`, []),
      400,
      "activityId",
      "Это не тест",
    );
    await expect(await send("PUT", questionsPath, questions), 200);
    await expect(
      await send("PUT", `${root}/quizzes/${bQuiz.id}/questions`, [
        { id: "q-a", type: "boolean", text: "Зависимый навык?", correct: true, skillId: b.id, hints: [] },
      ]),
      200,
    );
    const visible = await read(questionsPath, student);
    assert.equal(visible.length, questions.length);
    assert.equal(visible[0].hintsCount, 2);
    for (const item of visible) {
      assert.ok(!("correct" in item));
      assert.ok(!("hints" in item));
    }
    assert.equal((await read(questionsPath))[0].correct, 0);
    await expect(await send("PUT", questionsPath, [], student), 403);
  });

  await t.test("пререквизиты, слабейший навык и дедупликация рекомендаций", async () => {
    assert.equal((await mastery(b)).status, "locked");
    const first = await next();
    assert.equal(first.recommendation.skillId, a.id);
    assert.equal(first.recommendation.activityId, quiz.id);
    assert.equal(first.recommendation.reasonCode, "weakest_skill");
    assert.match(first.recommendation.reasonText, /30%/);
    assert.deepEqual((await next()).recommendation, first.recommendation);
    const count = await sql(
      `SELECT count(*) FROM "Recommendations" WHERE "UserId" = ${literal(student.user.id)} AND "CourseId" = ${literal(course.id)}`,
    );
    assert.equal(count, "1");
    assert.deepEqual(first.personal.find((item) => item.skillId === a.id).activityIds, [video.id, pdf.id]);
    assert.ok(!first.personal.some((item) => item.skillId === b.id));
    await expect(
      await send(
        "POST",
        `/api/me/recommendations/${first.recommendation.id}`,
        { status: "accepted" },
        student,
      ),
      204,
    );
    await expect(
      await send("POST", `/api/me/recommendations/${first.recommendation.id}`, { status: "skipped" }, other),
      404,
    );
  });

  await t.test("попытки, точные значения BKT, подсказки, короткий ответ и запрет повторов", async () => {
    firstAttempt = await start();
    const resumed = await expect(await send("POST", `${root}/quizzes/${quiz.id}/attempts`, {}, student), 200);
    assert.equal(resumed.attemptId, firstAttempt.attemptId);
    assert.ok(!("correct" in firstAttempt.questions[0]));
    assert.ok(!("hints" in firstAttempt.questions[0]));
    let p = 0.3;
    let result = await answer(firstAttempt, "q-a", 0);
    p = bkt(p, true, 0.5);
    assert.deepEqual(result.skills[0], { skillId: a.id, before: 0.3, after: p, status: "learning" });
    const duplicate = await Promise.all([
      send(
        "POST",
        `/api/attempts/${firstAttempt.attemptId}/answers`,
        { questionId: "q-wrong", given: false },
        student,
      ),
      send(
        "POST",
        `/api/attempts/${firstAttempt.attemptId}/answers`,
        { questionId: "q-wrong", given: false },
        student,
      ),
    ]);
    assert.deepEqual(duplicate.map((item) => item.status).sort(), [200, 409]);
    const wrong = await duplicate.find((item) => item.status === 200).json();
    const wrongP = bkt(p, false, 0.5);
    assert.equal(wrong.skills[0].after, wrongP);
    assert.ok(wrongP < p);
    p = wrongP;
    const hint = await expect(
      await send("POST", `/api/attempts/${firstAttempt.attemptId}/hint`, { questionId: "q-hint" }, student),
      200,
    );
    assert.deepEqual(hint, { level: 1, text: "Ответ — первый", hintsLeft: 0 });
    assert.equal(
      (
        await expect(
          await send(
            "POST",
            `/api/attempts/${firstAttempt.attemptId}/hint`,
            { questionId: "q-hint" },
            student,
          ),
          409,
        )
      ).error,
      "Подсказок больше нет",
    );
    result = await answer(firstAttempt, "q-hint", 0);
    assert.equal(result.isCorrect, true);
    assert.equal(result.skills[0].after, bkt(p, false, 1 / 3));
    p = result.skills[0].after;
    result = await answer(firstAttempt, "q-short", "  Это ПРОМПТ для нейросети  ");
    assert.equal(result.isCorrect, true);
    assert.equal(result.skills[0].after, bkt(p, true, 0.05));
    await expect(
      await send(
        "POST",
        `/api/attempts/${firstAttempt.attemptId}/answers`,
        { questionId: "q-a", given: 0 },
        student,
      ),
      409,
    );
    const score = await submit(firstAttempt);
    assert.deepEqual(score, { score: 3, max: 6, percent: 50 });
    assert.deepEqual(await submit(firstAttempt), score);
    await expect(
      await send(
        "POST",
        `/api/attempts/${firstAttempt.attemptId}/answers`,
        { questionId: "q-fallback", given: true },
        student,
      ),
      409,
    );
    await expect(
      await send("POST", `/api/attempts/${firstAttempt.attemptId}/hint`, { questionId: "q-a" }, student),
      409,
    );
  });

  await t.test("доступ только к своей попытке, зачисления и CSRF для всех записей", async () => {
    for (const suffix of ["answers", "hint", "submit"])
      await expect(
        await send(
          "POST",
          `/api/attempts/${firstAttempt.attemptId}/${suffix}`,
          { questionId: "q-a", given: 0 },
          other,
        ),
        404,
      );
    assert.equal((await get(apiUrl, `${root}/events?userId=${other.user.id}`, student.cookie)).status, 403);
    const denied = await expect(await get(apiUrl, `${me}/progress`, outsider.cookie), 403);
    assert.equal(denied.error, "Вы не записаны на этот курс");
    assert.equal((await get(apiUrl, skillsPath, outsider.cookie)).status, 404);
    for (const [method, path, body, actor] of [
      ["POST", `${root}/quizzes/${quiz.id}/attempts`, {}, student],
      ["POST", `/api/attempts/${firstAttempt.attemptId}/answers`, { questionId: "q-a", given: 0 }, student],
      ["POST", `/api/attempts/${firstAttempt.attemptId}/hint`, { questionId: "q-a" }, student],
      ["POST", `/api/attempts/${firstAttempt.attemptId}/submit`, {}, student],
      ["POST", `${me}/events`, { type: "activity.completed", activityId: video.id }, student],
      ["PATCH", `${root}/adaptive`, { enabled: false }, tutor],
      ["PUT", questionsPath, questions, tutor],
      [
        "PUT",
        `${root}/adaptive/students/${student.user.id}/pin`,
        { activityId: video.id, reason: "Проверка" },
        tutor,
      ],
    ])
      await expect(await send(method, path, body, actor, false), 403);
    await expect(
      await send("POST", `${me}/events`, { type: "skill.mastered", activityId: video.id }, student),
      400,
    );
  });

  await t.test("серия ответов осваивает навык, открывает пререквизиты и не понижает освоенный", async () => {
    for (let i = 0; i < 10 && (await mastery(a)).status !== "mastered"; i++) {
      const attempt = await start();
      await answer(attempt, "q-a", 0);
      await submit(attempt);
    }
    assert.equal((await mastery(a)).status, "mastered");
    assert.equal((await mastery(b)).status, "learning");
    const attempt = await start();
    await answer(attempt, "q-a", 1);
    await submit(attempt);
    assert.equal((await mastery(a)).status, "mastered");
    const events = await read(`${root}/events?userId=${student.user.id}&type=skill.mastered`);
    assert.equal(events.filter((item) => item.skillId === a.id).length, 1);
    assert.equal(
      (await expect(await send("DELETE", `${skillsPath}/${a.id}`), 409)).error,
      "По навыку уже есть результаты учеников",
    );
  });

  await t.test("ручные master/reset/unlock, pin, отключение адаптации и дедупликация событий", async () => {
    assert.equal((await override(b, "master")).status, "mastered");
    assert.equal((await override(a, "reset")).status, "learning");
    assert.equal((await mastery(b)).status, "mastered");
    assert.equal((await override(b, "reset")).status, "locked");
    assert.equal((await override(b, "unlock")).unlockedByTeacher, true);
    await expect(
      await send("PUT", `${root}/adaptive/students/${student.user.id}/skills/${a.id}`, {
        action: "master",
        reason: "а",
      }),
      400,
      "reason",
      "Укажите причину — от 3 до 500 символов",
    );
    await expect(
      await send("PUT", `${root}/adaptive/students/${outsider.user.id}/skills/${a.id}`, {
        action: "master",
        reason: "Проверка",
      }),
      404,
    );
    const previous = await next();
    await expect(
      await send("PUT", `${root}/adaptive/students/${student.user.id}/pin`, {
        activityId: assignment.id,
        reason: "Проверить практику",
      }),
      200,
    );
    const pinned = await next();
    assert.equal(pinned.recommendation.activityId, assignment.id);
    assert.equal(pinned.recommendation.reasonCode, "pinned_by_teacher");
    assert.equal(pinned.recommendation.reasonText, "Задание назначил преподаватель: Проверить практику");
    assert.equal(
      await sql(`SELECT "Status" FROM "Recommendations" WHERE "Id" = ${literal(previous.recommendation.id)}`),
      "overridden",
    );
    await expect(
      await send("PUT", `${root}/adaptive/students/${student.user.id}/pin`, {
        activityId: null,
        reason: "Снять закрепление",
      }),
      204,
    );
    await expect(await send("PATCH", `${root}/adaptive`, { enabled: false }), 200);
    const linear = await next();
    assert.equal(linear.recommendation.activityId, video.id);
    assert.equal(linear.recommendation.reasonCode, "linear_order");
    await expect(
      await send(
        "POST",
        `/api/me/recommendations/${linear.recommendation.id}`,
        { status: "skipped" },
        student,
      ),
      204,
    );
    const dashboard = await read(`${root}/adaptive`);
    assert.equal(dashboard.enabled, false);
    assert.deepEqual(
      dashboard.students.map((item) => item.id).sort(),
      [student.user.id, other.user.id].sort(),
    );
    assert.equal(
      dashboard.students.find((item) => item.id === student.user.id).skills[b.id].unlockedByTeacher,
      true,
    );
    await expect(await send("PATCH", `${root}/adaptive`, { enabled: true }), 200);
    assert.equal((await get(apiUrl, `${root}/adaptive`, student.cookie)).status, 403);
  });

  await t.test("прогресс: 70% навыки + 30% материалы, уникальные завершения", async () => {
    await override(a, "master");
    await expect(
      await send(
        "POST",
        `${me}/events`,
        { type: "activity.viewed", activityId: video.id, coverage: 50 },
        student,
      ),
      204,
    );
    for (let i = 0; i < 2; i++)
      await expect(
        await send(
          "POST",
          `${me}/events`,
          { type: "activity.completed", activityId: video.id, coverage: 100 },
          student,
        ),
        204,
      );
    const result = await progress();
    assert.deepEqual(result.materials, { done: 2, total: 5 });
    const mastered = result.skills.filter((item) => item.status === "mastered").length;
    assert.equal(
      result.progress,
      Math.round(100 * ((0.7 * mastered) / result.skills.length + (0.3 * 2) / 5)),
    );
    assert.equal((await progress(other)).progress, 0);
    for (const skill of await read(skillsPath)) await override(skill, "master");
    const finished = await next();
    assert.equal(finished.recommendation.reasonCode, "all_mastered");
    assert.equal(finished.recommendation.activityId, null);
  });

  await t.test("журнал: порядок событий, актор, фильтры и запрет перезаписи в PostgreSQL", async () => {
    const events = await read(`${root}/events?userId=${student.user.id}&limit=500`);
    const chronological = events.toReversed();
    const actions = chronological.filter((item) => item.payload.attemptId === firstAttempt.attemptId);
    assert.equal(actions[0].type, "attempt.started");
    assert.equal(actions.at(-1).type, "attempt.submitted");
    assert.ok(actions.some((item) => item.type === "hint.requested"));
    assert.ok(actions.some((item) => item.type === "answer.submitted"));
    assert.ok(actions.every((item) => item.actorId === student.user.id));
    assert.ok(events.some((item) => item.type === "teacher.override" && item.actorId === tutor.user.id));
    for (let i = 1; i < events.length; i++) assert.ok(new Date(events[i - 1].at) >= new Date(events[i].at));
    const ownEvents = await read(`${root}/events`, student);
    assert.ok(ownEvents.every((item) => item.userId === student.user.id));
    assert.ok(
      (await read(`${root}/events?type=attempt.started&limit=1`)).every(
        (item) => item.type === "attempt.started",
      ),
    );
    await assert.rejects(
      sql(`UPDATE "LearningEvents" SET "Type" = 'tampered' WHERE "Id" = ${events[0].id}`),
      /append.only|только добавление/i,
    );
    await assert.rejects(
      sql(`DELETE FROM "LearningEvents" WHERE "Id" = ${events[0].id}`),
      /append.only|только добавление/i,
    );
  });

  await t.test("попытка хранит прежние вопросы после редактирования и удаления материала", async () => {
    const snapshot = await start(other);
    await expect(
      await send("PUT", questionsPath, [{ ...questions[0], correct: 1, hints: ["Новая подсказка"] }]),
      200,
    );
    const hint = await expect(
      await send("POST", `/api/attempts/${snapshot.attemptId}/hint`, { questionId: "q-a" }, other),
      200,
    );
    assert.equal(hint.text, "Первая подсказка");
    await expect(await send("DELETE", `${root}/activities/${quiz.id}`), 204);
    assert.equal((await answer(snapshot, "q-a", 0, other)).isCorrect, true);
    const result = await submit(snapshot, other);
    assert.equal(result.max, questions.length);
    const review = await next(other);
    assert.equal(review.recommendation.reasonCode, "review_material");
    assert.equal(review.recommendation.activityId, video.id);
    assert.equal(review.recommendation.reasonText, `Повторите материал по навыку «${a.title}»`);
    assert.equal((await read(questionsPath.replace(quiz.id, bQuiz.id), student))[0].id, "q-a");
  });

  await t.test("fallback навыков материала/модуля и линейный прогресс без тестов", async () => {
    const attempt = await start(student, bQuiz);
    // Явный SkillId имеет приоритет перед ActivitySkills.
    await expect(await send("PUT", `${root}/activities/${bQuiz.id}/skills`, { skillIds: [c.id] }), 200);
    assert.deepEqual(
      (await answer(attempt, "q-a", true)).skills.map((item) => item.skillId),
      [b.id],
    );
    await submit(attempt);
    const autoQuiz = await expect(
      await send("POST", `${root}/sections/${autoSection.id}/activities`, {
        type: "quiz",
        title: "Авто-привязка",
      }),
      201,
    );
    await expect(
      await send("PUT", `${root}/quizzes/${autoQuiz.id}/questions`, [
        { type: "boolean", text: "Все навыки модуля?", correct: true },
      ]),
      200,
    );
    const fallback = await start(student, autoQuiz);
    const ids = (await answer(fallback, fallback.questions[0].id, true)).skills
      .map((item) => item.skillId)
      .sort();
    const sectionSkills = (await read(skillsPath))
      .filter((item) => item.sectionId === autoSection.id)
      .map((item) => item.id)
      .sort();
    assert.deepEqual(ids, sectionSkills);
    await submit(fallback);
    await expect(
      await send("PUT", `${root}/activities/${autoQuiz.id}/skills`, { skillIds: [a.id, c.id] }),
      200,
    );
    const linked = await start(student, autoQuiz);
    assert.deepEqual(
      (await answer(linked, linked.questions[0].id, true)).skills.map((item) => item.skillId).sort(),
      [a.id, c.id].sort(),
    );
    await submit(linked);
    await expect(await send("DELETE", `${root}/activities/${autoQuiz.id}`), 204);
    await expect(await send("DELETE", `${root}/activities/${bQuiz.id}`), 204);
    const result = await progress();
    assert.deepEqual(result.materials, { done: 1, total: 3 });
    assert.equal(result.progress, 33);
  });

  await t.test("первый ответ создаёт авто-навык без предварительного GET skills", async () => {
    const unmarked = await expect(
      await send("POST", `${root}/sections`, { title: "Неразмеченный модуль" }),
      201,
    );
    const test = await expect(
      await send("POST", `${root}/sections/${unmarked.id}/activities`, {
        type: "quiz",
        title: "Тест без разметки",
      }),
      201,
    );
    const saved = await expect(
      await send("PUT", `${root}/quizzes/${test.id}/questions`, [
        { type: "boolean", text: "Авто-навык?", correct: true },
      ]),
      200,
    );
    assert.match(saved[0].id, /^q-[a-f0-9]{8}$/);
    assert.equal(
      await sql(
        `SELECT count(*) FROM "Skills" WHERE "CourseId" = ${literal(course.id)} AND "SectionId" = ${literal(unmarked.id)}`,
      ),
      "0",
    );
    const attempt = await start(student, test);
    const learned = await answer(attempt, attempt.questions[0].id, true);
    assert.equal(learned.skills.length, 1);
    assert.equal(
      await sql(`SELECT "IsAuto" FROM "Skills" WHERE "Id" = ${literal(learned.skills[0].skillId)}`),
      "t",
    );
    await submit(attempt);
    await expect(await send("DELETE", `${root}/activities/${test.id}`), 204);
    await expect(await send("DELETE", `${root}/sections/${unmarked.id}`), 409);
  });

  await t.test("демо-сид актуального c-dor-ai проверяется только чтением", async () => {
    const seedSkills = await read("/api/courses/c-dor-ai/skills");
    assert.equal(seedSkills.length, 4);
    assert.ok(seedSkills.every((item) => item.code.startsWith("ОПК-1.")));
    const seedQuestions = await read("/api/courses/c-dor-ai/quizzes/mq1/questions");
    assert.equal(seedQuestions.length, 12);
    for (const skill of seedSkills)
      assert.equal(seedQuestions.filter((item) => item.skillId === skill.id).length, 3);
    assert.deepEqual(
      seedQuestions.slice(0, 3).map((item) => item.id),
      ["mq1q1", "mq1q2", "mq1q3"],
    );
    assert.ok(seedQuestions.every((item) => item.hints.length >= 2));
    assert.equal(seedQuestions[0].correct, 0);
    assert.equal(seedQuestions[1].correct, true);
    assert.equal(seedQuestions[2].correct, "промпт");
  });
});
