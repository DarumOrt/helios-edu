import assert from "node:assert/strict";
import { test } from "node:test";
import { apiUrl, get, login } from "./client.mjs";

// Объявления и уведомления в PostgreSQL (Notifications/NotificationsEndpoints.cs), напрямую и через Next.
for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: объявления курса, уведомления, прочитанность и близкие сроки`, async () => {
    const origin = process.env.TEST_WEB_URL ? new URL(process.env.TEST_WEB_URL).origin : undefined;
    const send = (cookie, method, path, body) =>
      fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-Helios-Client": "web",
          ...(origin && { Origin: origin }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const student = await login(baseUrl, "student10@student.pspu.ru");
    const outsider = await login(baseUrl, "student4@student.pspu.ru");
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const root = "/api/courses/c-dor-ai";

    // объявление пишет преподаватель курса; поля проверяются, ученику писать нельзя
    const bad = await send(tutor.cookie, "POST", `${root}/announcements`, { title: "Эх", body: "" });
    assert.equal(bad.status, 400);
    assert.deepEqual((await bad.json()).fields, {
      title: "Заголовок — от 3 до 120 символов",
      body: "Текст — от 1 до 2000 символов",
    });
    assert.equal(
      (await send(student.cookie, "POST", `${root}/announcements`, { title: "Привет", body: "Текст" }))
        .status,
      403,
    );
    const title = `Консультация ${Date.now()}`;
    const created = await send(tutor.cookie, "POST", `${root}/announcements`, {
      title,
      body: "В пятницу в 17:00",
    });
    assert.equal(created.status, 201);
    const announcement = await created.json();
    assert.equal(announcement.authorName, "Казаринова Н.Л.");

    // объявление видят ученики курса — в ленте курса и в уведомлениях; чужой группе курс не виден
    const list = await (await get(baseUrl, `${root}/announcements`, student.cookie)).json();
    assert.equal(list[0].id, announcement.id);
    assert.equal((await get(baseUrl, `${root}/announcements`, outsider.cookie)).status, 404);
    const unread = async () =>
      (await (await get(baseUrl, "/api/notifications", student.cookie)).json()).find(
        (n) => n.id === announcement.id,
      );
    const item = await unread();
    assert.deepEqual(
      [item.type, item.title, item.read, item.link],
      ["announcement", `ЦОР-201: ${title}`, false, "/courses/c-dor-ai"],
    );
    assert.ok(
      !(await (await get(baseUrl, "/api/notifications", outsider.cookie)).json()).some(
        (n) => n.id === announcement.id,
      ),
    );

    // прочитанность — своя у каждого, повторная отметка не ошибка
    assert.equal(
      (await send(student.cookie, "POST", `/api/notifications/${announcement.id}/read`, {})).status,
      200,
    );
    assert.equal(
      (await send(student.cookie, "POST", `/api/notifications/${announcement.id}/read`, {})).status,
      200,
    );
    assert.equal((await unread()).read, true);
    // несуществующее и чужое уведомление отметить нельзя
    assert.equal((await send(student.cookie, "POST", "/api/notifications/no-such/read", {})).status, 404);
    assert.equal(
      (await send(outsider.cookie, "POST", `/api/notifications/${announcement.id}/read`, {})).status,
      404,
    );

    // «скоро дедлайн»: задание со сроком завтра появляется у ученика, у преподавателя — нет
    const section = (await (await get(baseUrl, root, tutor.cookie)).json()).sections[0];
    const due = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const added = await send(tutor.cookie, "POST", `${root}/sections/${section.id}/activities`, {
      type: "assignment",
      title: `Срочное задание ${Date.now()}`,
      due,
    });
    assert.equal(added.status, 201);
    const activity = await added.json();
    try {
      const soon = (await (await get(baseUrl, "/api/notifications", student.cookie)).json()).find(
        (n) => n.id === `due-c-dor-ai-${activity.id}`,
      );
      assert.ok(soon, "ученик видит близкий срок");
      assert.equal(soon.type, "deadline");
      assert.ok(soon.body.startsWith(`${activity.title} — до `));
      assert.ok(
        !(await (await get(baseUrl, "/api/notifications", tutor.cookie)).json()).some(
          (n) => n.type === "deadline",
        ),
      );
    } finally {
      assert.equal((await send(tutor.cookie, "DELETE", `${root}/activities/${activity.id}`)).status, 204);
    }
  });

  test(`${name}: проверка работы присылает ученику «Оценка выставлена»`, async () => {
    const origin = process.env.TEST_WEB_URL ? new URL(process.env.TEST_WEB_URL).origin : undefined;
    const send = (cookie, method, path, body) =>
      fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-Helios-Client": "web",
          ...(origin && { Origin: origin }),
        },
        body: JSON.stringify(body),
      });
    const student = await login(baseUrl, "student11@student.pspu.ru");
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const submitted = await send(student.cookie, "POST", "/api/assignment/ma1/submit", {
      courseId: "c-dor-ai",
      text: "Тренажёр готов",
    });
    // повторный прогон на той же базе: работа уже проверена
    if (submitted.status === 409) return;
    assert.equal(submitted.status, 201);
    const { id } = await submitted.json();
    assert.equal(
      (await send(tutor.cookie, "POST", `/api/submissions/${id}/review`, { grade: 76 })).status,
      200,
    );
    const grade = (await (await get(baseUrl, "/api/notifications", student.cookie)).json()).find(
      (n) => n.type === "grade" && n.body.endsWith(": 76 из 100"),
    );
    assert.ok(grade, "уведомление об оценке");
    assert.deepEqual([grade.title, grade.read, grade.link], ["Оценка выставлена", false, "/gradebook"]);
  });
}
