import assert from "node:assert/strict";
import { test } from "node:test";
import { apiUrl, get, login } from "./client.mjs";

// Трекинг, аналитика, лидерборд и расписание в PostgreSQL (Tracking/TrackingEndpoints.cs), напрямую и через Next.
// Повторный прогон на той же базе не ломается: прогресс только растёт, события добавляются.
for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: трекинг, аналитика курса и урока, лидерборд, расписание`, async (t) => {
    const origin = new URL(baseUrl).origin;
    const send = (actor, path, body) =>
      fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          Cookie: actor.cookie,
          "Content-Type": "application/json",
          "X-Helios-Client": "web",
          Origin: origin,
        },
        body: JSON.stringify(body),
      });
    const read = async (actor, path, status = 200) => {
      const response = await get(baseUrl, path, actor.cookie);
      assert.equal(response.status, status, path);
      return status === 200 ? response.json() : null;
    };
    const student = await login(baseUrl); // u-stud-2, М1227
    const outsider = await login(baseUrl, "student4@student.pspu.ru");
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const session = `test-${Date.now()}`;

    await t.test("прогресс: ученик из сессии, курс обязателен, покрытие не уменьшается", async () => {
      const snapshot = {
        courseId: "c-dor-ai",
        activityId: "mv1",
        activityType: "video",
        sessionId: session,
        coverage: 30,
        activeTimeSec: 90,
        completed: false,
        position: 41,
        userId: "u-stud-1",
      };
      assert.equal((await send(student, "/api/tracking/progress", snapshot)).status, 200);
      assert.equal(
        (
          await send(student, "/api/tracking/progress", {
            ...snapshot,
            sessionId: `${session}-2`,
            coverage: 10,
          })
        ).status,
        200,
      );
      const mine = await read(student, "/api/tracking/progress?courseId=c-dor-ai&activityId=mv1");
      assert.equal(mine.userId, student.user.id, "userId из тела не используется");
      assert.ok(mine.coverage >= 30);
      assert.equal(mine.position, 41);
      assert.ok(mine.sessions >= 2);
      // чужой курс, чужой материал, без сессии
      assert.equal((await send(outsider, "/api/tracking/progress", snapshot)).status, 404);
      assert.equal(
        (await send(student, "/api/tracking/progress", { ...snapshot, activityId: "ma1" })).status,
        404,
      );
      assert.equal(
        (await send(student, "/api/tracking/progress", { ...snapshot, sessionId: "" })).status,
        400,
      );
    });

    await t.test("события: «пульс» и чужие материалы не сохраняются, не больше 200 за раз", async () => {
      const event = (verb, extra = {}) => ({
        sessionId: session,
        activityId: "mv1",
        activityType: "video",
        verb,
        ts: Date.now(),
        ...extra,
      });
      const accepted = await (
        await send(student, "/api/tracking/events", {
          courseId: "c-dor-ai",
          events: [
            event("opened"),
            event("heartbeat"),
            event("seeked", { position: 12.5, payload: { from: 3 } }),
            event("opened", { activityId: "nope" }),
          ],
        })
      ).json();
      assert.deepEqual(accepted, { ok: true, accepted: 2 });
      assert.equal(
        (
          await send(student, "/api/tracking/events", {
            courseId: "c-dor-ai",
            events: Array.from({ length: 201 }, () => event("paused")),
          })
        ).status,
        400,
      );
    });

    await t.test("аналитика: преподаватель своего курса, ученики — из групп курса", async () => {
      await read(student, "/api/analytics/course/c-dor-ai", 403);
      await read(tutor, "/api/analytics/course/c-ai-teaching", 404);
      const course = await read(tutor, "/api/analytics/course/c-dor-ai");
      const video = course.activities.find((a) => a.activityId === "mv1");
      assert.equal(video.total, 16, "все студенты М1227");
      assert.ok(video.started >= 15);
      assert.deepEqual(
        course.activities.map((a) => a.type),
        ["video", "presentation", "pdf", "quiz"],
      );
      const lesson = await read(
        tutor,
        `/api/analytics/lesson/mv1?courseId=c-dor-ai&userId=${student.user.id}`,
      );
      assert.equal(lesson.rows.length, 1);
      assert.equal(lesson.rows[0].status, "in_progress");
      const verbs = lesson.events.map((e) => e.verb);
      assert.ok(verbs.includes("opened") && verbs.includes("seeked") && !verbs.includes("heartbeat"));
      assert.equal(lesson.events.find((e) => e.verb === "seeked").position, 12.5);
    });

    await t.test("лидерборд: вся группа, тесты — лучший результат, своё место отмечено", async () => {
      const board = await read(student, "/api/hub/leaderboard?courseId=c-dor-ai");
      assert.equal(board.entries.length, 16);
      assert.deepEqual(
        board.entries.map((e) => e.rank),
        Array.from({ length: 16 }, (_, i) => i + 1),
      );
      assert.equal(
        board.entries
          .filter((e) => e.isCurrentUser)
          .map((e) => e.userId)
          .join(),
        student.user.id,
      );
      // порядок — по баллу; другие наборы тестов тоже сдают работы, поэтому первое место не фиксируем
      assert.ok(board.entries.every((e, i) => i === 0 || board.entries[i - 1].score >= e.score));
      const sokolova = board.entries.find((e) => e.userName === "Анастасия Соколова");
      assert.equal(sokolova.quizAvg, 95, "лучший результат теста из начальных данных");
      assert.ok(sokolova.rank <= 3);
      assert.ok(board.entries.every((e) => e.materialsTotal === 5 && e.streak >= 0));
      await read(outsider, "/api/hub/leaderboard?courseId=c-dor-ai", 404);
    });

    await t.test("расписание: своя группа, чужая — 403, без группы — 400", async () => {
      const week = await read(student, `/api/schedule?group=${encodeURIComponent("М1227")}`);
      assert.equal(week.slots.length, 11);
      assert.equal(week.pairs.length, 8);
      assert.equal(week.slots.find((s) => s.courseId === "c-dor-ai").course.code, "ЦОР-201");
      await read(student, `/api/schedule?group=${encodeURIComponent("1237")}`, 403);
      await read(student, "/api/schedule", 400);
      assert.equal((await read(tutor, `/api/schedule?group=${encodeURIComponent("М1227")}`)).group, "М1227");
    });
  });
}
