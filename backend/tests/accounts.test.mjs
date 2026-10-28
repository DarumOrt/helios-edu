import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { apiUrl, get, login } from "./client.mjs";

// Пароли и удаление пользователей (Management/ManagementEndpoints.cs, Auth/AuthEndpoints.cs).
test("C#: временный пароль, смена пароля, сброс и удаление пользователя", async (t) => {
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
  const tryLogin = (email, password) =>
    fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Helios-Client": "web" },
      body: JSON.stringify({ email, password }),
    });
  const organizer = await login(apiUrl, "organizer@pspu.ru");
  const unique = `${Date.now()}${randomBytes(2).toString("hex")}`;
  const created = await expect(
    await send(organizer, "POST", "/api/users", {
      name: "Пароль Проверка",
      email: `pw-${unique}@example.ru`,
      role: "tutor",
    }),
    201,
  );
  const email = created.user.email;
  let password = created.temporaryPassword;

  await t.test("временный пароль — при входе попросить сменить", async () => {
    const session = await login(apiUrl, email, password);
    assert.equal(session.user.mustChangePassword, true);
    const other = await login(apiUrl, email, password);
    const bad = await expect(
      await send(session, "POST", "/api/auth/password", {
        currentPassword: "не тот",
        newPassword: "короткий",
      }),
      400,
    );
    assert.deepEqual(bad.fields, {
      currentPassword: "Текущий пароль неверный",
      newPassword: "Пароль: не короче 8 символов, буквы и цифра",
    });
    const changed = await expect(
      await send(session, "POST", "/api/auth/password", {
        currentPassword: password,
        newPassword: "НовыйПароль2026",
      }),
      200,
    );
    assert.ok(!("mustChangePassword" in changed));
    password = "НовыйПароль2026";
    // эта сессия работает, другие закрыты
    assert.equal((await get(apiUrl, "/api/auth/me", session.cookie)).status, 200);
    assert.equal((await get(apiUrl, "/api/auth/me", other.cookie)).status, 401);
    assert.equal((await tryLogin(email, created.temporaryPassword)).status, 401);
  });

  await t.test("сброс пароля: один раз показанный временный, старые сессии закрыты", async () => {
    const session = await login(apiUrl, email, password);
    const reset = await expect(
      await send(organizer, "POST", `/api/users/${created.user.id}/password-reset`, {}),
      200,
    );
    assert.match(reset.temporaryPassword, /^[A-HJ-NP-Za-km-z2-9]{12}$/);
    assert.equal(reset.user.mustChangePassword, true);
    assert.equal((await get(apiUrl, "/api/auth/me", session.cookie)).status, 401);
    assert.equal((await tryLogin(email, password)).status, 401);
    assert.equal((await login(apiUrl, email, reset.temporaryPassword)).user.mustChangePassword, true);
    // администратора организатор не трогает, студент — никого
    await expect(await send(organizer, "POST", "/api/users/u-admin/password-reset", {}), 403);
    const student = await login(apiUrl);
    await expect(await send(student, "POST", `/api/users/${created.user.id}/password-reset`, {}), 403);
  });

  await t.test("удаление: без данных — полностью, с данными — обезличивание", async () => {
    await expect(await send(organizer, "DELETE", "/api/users/u-admin"), 403);
    await expect(await send(organizer, "DELETE", `/api/users/${organizer.user.id}`), 400);
    // у преподавателя без курсов и учёбы данных нет — удаляется полностью
    await expect(await send(organizer, "DELETE", `/api/users/${created.user.id}`), 204);
    assert.equal(
      (await expect(await send(organizer, "GET", "/api/users"), 200)).some((u) => u.id === created.user.id),
      false,
    );
    await expect(await send(organizer, "DELETE", `/api/users/${created.user.id}`), 404);

    // студент с прогрессом в курсе — обезличивается: имя и почта стёрты, вход закрыт, данные на месте
    const group = await expect(await send(organizer, "POST", "/api/cohorts", { name: `У-${unique}` }), 201);
    const learner = await expect(
      await send(organizer, "POST", "/api/users", {
        name: "Учёба Есть",
        email: `learn-${unique}@example.ru`,
        role: "student",
        group: group.name,
      }),
      201,
    );
    await expect(
      await send(organizer, "PATCH", `/api/cohorts/${group.id}`, { courseIds: ["c-dor-ai"] }),
      200,
    );
    try {
      const session = await login(apiUrl, learner.user.email, learner.temporaryPassword);
      await expect(
        await send(session, "POST", "/api/tracking/progress", {
          courseId: "c-dor-ai",
          activityId: "mv1",
          sessionId: `s-${unique}`,
          coverage: 20,
          activeTimeSec: 30,
          completed: false,
        }),
        200,
      );
      await expect(await send(organizer, "DELETE", `/api/users/${learner.user.id}`), 204);
      assert.equal((await get(apiUrl, "/api/auth/me", session.cookie)).status, 401);
      assert.equal((await tryLogin(learner.user.email, learner.temporaryPassword)).status, 401);
      const tutor = await login(apiUrl, "tutor@pspu.ru");
      const lesson = await expect(
        await send(tutor, "GET", `/api/analytics/lesson/mv1?courseId=c-dor-ai&userId=${learner.user.id}`),
        200,
      );
      assert.deepEqual([lesson.rows[0].userName, lesson.rows[0].coverage], ["Удалённый пользователь", 20]);
    } finally {
      // группа больше не ведёт курс — число участников c-dor-ai прежнее
      await expect(await send(organizer, "PATCH", `/api/cohorts/${group.id}`, { courseIds: [] }), 200);
    }
  });
});
