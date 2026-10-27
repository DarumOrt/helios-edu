import assert from "node:assert/strict";
import { test } from "node:test";
import { apiUrl, get, login } from "./client.mjs";

// Сданные работы и журнал оценок в PostgreSQL (Grades/GradesEndpoints.cs), напрямую и через Next.
// Повторный прогон на той же базе не ломается: проверенную работу пересдать нельзя (409) — это тоже проверяется.
for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: сдача работы, проверка и журнал оценок`, async () => {
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
    const student = await login(baseUrl, "student9@student.pspu.ru");
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const organizer = await login(baseUrl, "organizer@pspu.ru");

    // сдача: пустой ответ — ошибка поля; работа сохраняется на ученика из сессии
    const empty = await send(student.cookie, "POST", "/api/assignment/ma1/submit", {
      courseId: "c-dor-ai",
      text: " ",
    });
    assert.equal(empty.status, 400);
    assert.equal((await empty.json()).fields.text, "Добавьте ответ или файл");
    assert.equal(
      (
        await send(student.cookie, "POST", "/api/assignment/no-such/submit", {
          courseId: "c-dor-ai",
          text: "x",
        })
      ).status,
      404,
    );
    const text = `Работа ${Date.now()}`;
    const submitted = await send(student.cookie, "POST", "/api/assignment/ma1/submit", {
      courseId: "c-dor-ai",
      userId: "u-stud-1",
      text,
    });
    assert.ok([201, 409].includes(submitted.status), `сдача: ${submitted.status}`);

    // проверка: ученику список закрыт, оценка вне шкалы не сохраняется
    assert.equal((await get(baseUrl, "/api/submissions", student.cookie)).status, 403);
    const { items } = await (await get(baseUrl, "/api/submissions", tutor.cookie)).json();
    const work = items.find((s) => s.userId === student.user.id && s.assignmentId === "ma1");
    assert.ok(work, "работа видна преподавателю курса");
    assert.equal(work.courseId, "c-dor-ai");
    if (submitted.status === 201) {
      assert.equal(work.text, text);
      const tooHigh = await send(tutor.cookie, "POST", `/api/submissions/${work.id}/review`, { grade: 101 });
      assert.equal(tooHigh.status, 400);
      assert.equal((await tooHigh.json()).fields.grade, "Оценка — число от 0 до 100");
      assert.equal(
        (await send(organizer.cookie, "POST", `/api/submissions/${work.id}/review`, { grade: 80 })).status,
        403,
      );
      const reviewed = await send(tutor.cookie, "POST", `/api/submissions/${work.id}/review`, {
        grade: 87,
        feedback: "Хорошо",
      });
      assert.equal(reviewed.status, 200);
      assert.deepEqual(
        (({ status, grade, feedback }) => ({ status, grade, feedback }))(await reviewed.json()),
        { status: "reviewed", grade: 87, feedback: "Хорошо" },
      );
    }
    // проверенную работу пересдать нельзя
    assert.equal(
      (
        await send(student.cookie, "POST", "/api/assignment/ma1/submit", {
          courseId: "c-dor-ai",
          text: "ещё",
        })
      ).status,
      409,
    );

    // журнал: оценка за работу видна преподавателю, организатору и самому ученику
    const row = async (cookie) =>
      (await (await get(baseUrl, "/api/gradebook?courseId=c-dor-ai", cookie)).json()).find(
        (r) => r.userId === student.user.id,
      );
    const tutorRow = await row(tutor.cookie);
    assert.equal(tutorRow.items.find((i) => i.itemId === "ma1").grade, 87);
    assert.deepEqual(await row(organizer.cookie), tutorRow);
    const mine = (await (await get(baseUrl, "/api/gradebook/me", student.cookie)).json()).courses.find(
      (c) => c.courseId === "c-dor-ai",
    );
    assert.equal(mine.items.find((i) => i.itemId === "ma1").grade, 87);
    assert.equal((await get(baseUrl, "/api/gradebook?courseId=c-dor-ai", student.cookie)).status, 403);

    // оценка за тест вручную: ставится, итог пересчитывается, null — снимает
    const set = (cookie, grade) =>
      send(cookie, "POST", "/api/gradebook/grade", {
        courseId: "c-dor-ai",
        userId: student.user.id,
        itemId: "mq1",
        grade,
      });
    assert.equal((await set(organizer.cookie, 50)).status, 403);
    assert.equal((await set(tutor.cookie, 150)).status, 400);
    const withQuiz = await (await set(tutor.cookie, 73)).json();
    assert.equal(withQuiz.items.find((i) => i.itemId === "mq1").grade, 73);
    assert.equal(withQuiz.total, 80);
    const cleared = await (await set(tutor.cookie, null)).json();
    assert.equal(cleared.items.find((i) => i.itemId === "mq1").grade ?? null, null);

    // чужой курс преподавателя — не найден
    assert.equal((await get(baseUrl, "/api/gradebook?courseId=c-ai-teaching", tutor.cookie)).status, 404);
  });
}
