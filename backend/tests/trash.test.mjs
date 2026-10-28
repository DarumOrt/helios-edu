import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { promisify } from "node:util";
import { apiUrl, get, login } from "./client.mjs";

// Корзины (Courses/CourseTrash.cs): модули и материалы курса, курсы целиком; 7 дней, потом окончательно.
// Пока курс в корзине, оценки по нему остаются у студента; после очистки рейтинг считается без него.

const exec = promisify(execFile);
const sql = async (query) =>
  (
    await exec(
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
        "-At",
        "-c",
        query,
      ],
      { timeout: 30_000 },
    )
  ).stdout.trim();

test("C#: корзина курса и корзина курсов, окончательная очистка через 7 дней", async (t) => {
  const send = (actor, method, path, body) =>
    fetch(`${apiUrl}${path}`, {
      method,
      headers: { Cookie: actor.cookie, "Content-Type": "application/json", "X-Helios-Client": "web" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const expect = async (response, status) => {
    const text = await response.text();
    assert.equal(response.status, status, text);
    return text ? JSON.parse(text) : null;
  };
  const organizer = await login(apiUrl, "organizer@pspu.ru");
  const admin = await login(apiUrl, "admin@pspu.ru");
  const tutor = await login(apiUrl, "tutor@pspu.ru");
  const stranger = await login(apiUrl, "tutor2@pspu.ru");
  const unique = `${Date.now()}${randomBytes(2).toString("hex")}`;
  const code = `${[...randomBytes(6)].map((b) => String.fromCharCode(65 + (b % 26))).join("")}-777`;

  // свой курс, группа с одним студентом, задание с оценкой
  const course = await expect(
    await send(organizer, "POST", "/api/courses", {
      code,
      title: "Курс для корзины",
      category: "Тесты",
      description: "",
      tutorId: tutor.user.id,
    }),
    201,
  );
  const root = `/api/courses/${course.id}`;
  await expect(await send(organizer, "PATCH", root, { status: "published" }), 200);
  const group = await expect(await send(organizer, "POST", "/api/cohorts", { name: `К-${unique}` }), 201);
  const created = await expect(
    await send(organizer, "POST", "/api/users", {
      name: "Студент Корзины",
      email: `trash-${unique}@example.ru`,
      role: "student",
      group: group.name,
    }),
    201,
  );
  await expect(await send(organizer, "PATCH", `/api/cohorts/${group.id}`, { courseIds: [course.id] }), 200);
  const student = await login(apiUrl, created.user.email, created.temporaryPassword);
  const section = await expect(await send(tutor, "POST", `${root}/sections`, { title: "Модуль" }), 201);
  const task = await expect(
    await send(tutor, "POST", `${root}/sections/${section.id}/activities`, {
      type: "assignment",
      title: "Задание",
    }),
    201,
  );
  const quiz = await expect(
    await send(tutor, "POST", `${root}/sections/${section.id}/activities`, { type: "quiz", title: "Тест" }),
    201,
  );
  await expect(
    await send(tutor, "PUT", `${root}/quizzes/${quiz.id}/questions`, [
      { type: "boolean", text: "Верно?", correct: true },
    ]),
    200,
  );
  const submitted = await expect(
    await send(student, "POST", `/api/assignment/${task.id}/submit`, { courseId: course.id, text: "Ответ" }),
    201,
  );
  await expect(await send(tutor, "POST", `/api/submissions/${submitted.id}/review`, { grade: 80 }), 200);
  const myCourses = async () =>
    (await (await get(apiUrl, "/api/gradebook/me", student.cookie)).json()).courses.map((c) => c.courseId);

  await t.test("материал: в корзину и обратно — на прежнее место, с вопросами теста", async () => {
    await expect(await send(tutor, "DELETE", `${root}/activities/${quiz.id}`), 204);
    const items = await expect(await send(tutor, "GET", `${root}/trash`), 200);
    assert.deepEqual(
      items.map((i) => [i.kind, i.title, i.type]),
      [["activity", "Тест", "quiz"]],
    );
    await expect(await send(stranger, "GET", `${root}/trash`), 404);
    await expect(await send(tutor, "POST", `${root}/trash/${items[0].id}/restore`, {}), 200);
    const restored = await expect(await send(tutor, "GET", root), 200);
    assert.deepEqual(
      restored.sections[0].activities.map((a) => a.id),
      [task.id, quiz.id],
    );
    assert.equal(
      (await expect(await send(tutor, "GET", `${root}/quizzes/${quiz.id}/questions`), 200)).length,
      1,
    );
    // задание со сданной работой удалить по-прежнему нельзя
    await expect(await send(tutor, "DELETE", `${root}/activities/${task.id}`), 409);
  });

  await t.test("курс в корзину: студенту не виден, оценки сохраняются; восстановление", async () => {
    const impact = await expect(await send(tutor, "GET", `${root}/impact`), 200);
    assert.deepEqual(impact, { students: 1, submissions: 1, grades: 1, attempts: 0 });
    await expect(await send(stranger, "DELETE", root), 404);
    await expect(await send(tutor, "DELETE", root), 204);
    assert.equal((await get(apiUrl, root, student.cookie)).status, 404);
    assert.equal((await get(apiUrl, root, tutor.cookie)).status, 404);
    assert.ok(
      myCourses && (await myCourses()).includes(course.id),
      "рейтинг не меняется, пока курс в корзине",
    );
    const trash = await expect(await send(organizer, "GET", "/api/courses/trash"), 200);
    const entry = trash.find((c) => c.id === course.id);
    assert.deepEqual([entry.code, entry.impact.grades, entry.deletedByName], [code, 1, "Казаринова Н.Л."]);
    assert.ok(
      !(await expect(await send(stranger, "GET", "/api/courses/trash"), 200)).some((c) => c.id === course.id),
    );
    // тот же код — подсказка про корзину
    const dup = await expect(
      await send(organizer, "POST", "/api/courses", {
        code,
        title: "Дубль",
        category: "Тесты",
        description: "",
        tutorId: tutor.user.id,
      }),
      409,
    );
    assert.equal(dup.fields.code, "Курс с таким кодом в корзине — восстановите его или выберите другой код");
    await expect(await send(tutor, "POST", `${root}/restore`, {}), 200);
    assert.equal((await get(apiUrl, root, student.cookie)).status, 200);
    assert.deepEqual(
      (await expect(await send(organizer, "GET", `/api/cohorts/${group.id}`), 200)).courseIds,
      [course.id],
      "курс вернулся к своей группе",
    );
  });

  await t.test("через 7 дней — окончательно: курс и его оценки исчезают, рейтинг без него", async () => {
    await expect(await send(tutor, "DELETE", `${root}/activities/${quiz.id}`), 204);
    await sql(
      `UPDATE "TrashItems" SET "DeletedAt" = now() - interval '8 days' WHERE "CourseId" = '${course.id}'`,
    );
    let cleanup = await expect(await send(admin, "POST", "/api/files/cleanup", {}), 200);
    assert.ok(cleanup.courseItems >= 1);
    assert.deepEqual(await expect(await send(tutor, "GET", `${root}/trash`), 200), []);

    await expect(await send(tutor, "DELETE", root), 204);
    await sql(`UPDATE "Courses" SET "DeletedAt" = now() - interval '8 days' WHERE "Id" = '${course.id}'`);
    cleanup = await expect(await send(admin, "POST", "/api/files/cleanup", {}), 200);
    assert.ok(cleanup.courses >= 1);
    assert.equal(await sql(`SELECT count(*) FROM "Courses" WHERE "Id" = '${course.id}'`), "0");
    assert.equal(await sql(`SELECT count(*) FROM "Grades" WHERE "CourseId" = '${course.id}'`), "0");
    assert.ok(!(await myCourses()).includes(course.id), "рейтинг пересчитан без курса");
    await expect(await send(tutor, "POST", `${root}/restore`, {}), 404);
  });

  // студента — из группы, пустую группу — удалить
  await send(organizer, "PATCH", `/api/users/${created.user.id}`, { group: null, status: "blocked" });
  await send(organizer, "DELETE", `/api/cohorts/${group.id}`);
});
