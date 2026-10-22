import assert from "node:assert/strict";
import { test } from "node:test";
import { apiUrl, login, get, demoPassword } from "./client.mjs";

for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: без сессии курсы, профиль и пользователи недоступны`, async () => {
    for (const path of ["/api/auth/me", "/api/courses", "/api/courses/c-matan", "/api/users"])
      assert.equal((await get(baseUrl, path)).status, 401);
    assert.equal((await get(baseUrl, "/api/courses", "helios-auth=forged")).status, 401);
  });

  test(`${name}: неверный пароль, защита POST и отсутствие токенов в JSON`, async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Helios-Client": "web",
        Origin: new URL(baseUrl).origin,
      },
      body: JSON.stringify({ email: "vagulin@student.pspu.ru", password: "wrong-password" }),
    });
    assert.equal(response.status, 401);
    const crossSite = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://other.example" },
      body: JSON.stringify({ email: "vagulin@student.pspu.ru", password: "irrelevant" }),
    });
    assert.equal(crossSite.status, 403);
  });

  test(`${name}: роль берётся с сервера; список пользователей доступен только организатору и администратору`, async () => {
    for (const [email, role, status] of [
      ["vagulin@student.pspu.ru", "student", 403],
      ["kazarinova@pspu.ru", "tutor", 403],
      ["organizer@pspu.ru", "organizer", 200],
      ["admin@pspu.ru", "admin", 200],
    ]) {
      const session = await login(baseUrl, email);
      assert.equal(session.user.role, role);
      assert.match(session.setCookie, /httponly/i);
      assert.match(session.setCookie, /samesite=lax/i);
      assert.ok(!("passwordHash" in session.user));
      const response = await get(baseUrl, "/api/users", session.cookie);
      assert.equal(response.status, status);
      if (status === 200) for (const user of await response.json()) assert.ok(!("passwordHash" in user));
      const me = await get(baseUrl, "/api/auth/me", session.cookie);
      assert.deepEqual(await me.json(), session.user);
    }
  });

  test(`${name}: выход отзывает сессию на сервере`, async () => {
    const session = await login(baseUrl);
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: session.cookie, "X-Helios-Client": "web", Origin: new URL(baseUrl).origin },
    });
    assert.equal(response.status, 204);
    assert.equal((await get(baseUrl, "/api/auth/me", session.cookie)).status, 401);
    assert.equal((await get(baseUrl, "/api/courses", session.cookie)).status, 401);
  });

  test(`${name}: одногруппники доступны студенту только в своей группе`, async () => {
    const { cookie, user } = await login(baseUrl);
    const prefix = name === "C#" ? "/api/users/classmates" : "/api/users";
    const path = `${prefix}?group=${encodeURIComponent(user.group)}`;
    assert.equal((await get(baseUrl, path)).status, 401);
    const response = await get(baseUrl, path, cookie);
    assert.equal(response.status, 200);
    const classmates = await response.json();
    assert.ok(classmates.length > 1);
    assert.ok(classmates.every((member) => member.group === user.group && member.role === "student"));
    assert.ok(classmates.every((member) => !("passwordHash" in member)));
    assert.equal(
      (await get(baseUrl, `${prefix}?group=${encodeURIComponent("ЭК-1237")}`, cookie)).status,
      403,
    );
  });

  test(`${name}: поля role и userId в запросе входа не повышают права`, async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Helios-Client": "web",
        Origin: new URL(baseUrl).origin,
      },
      body: JSON.stringify({
        email: "vagulin@student.pspu.ru",
        password: demoPassword,
        role: "admin",
        userId: "u-admin",
      }),
    });
    assert.equal(response.status, 200);
    const user = await response.json();
    assert.equal(user.id, "u-stud-2");
    assert.equal(user.role, "student");
  });
}

if (process.env.TEST_WEB_URL)
  test("Next.js: защищённый кабинет ведёт на страницу входа", async () => {
    const baseUrl = process.env.TEST_WEB_URL;
    const response = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location"), baseUrl).pathname, "/login");
    const loginPage = await fetch(`${baseUrl}/login`);
    assert.equal(loginPage.status, 200);
    assert.ok((await loginPage.text()).includes("Вход в личный кабинет"));
  });

if (process.env.TEST_WEB_URL)
  test("Next.js: моковые маршруты проверяют права и не принимают чужой userId", async () => {
    const baseUrl = process.env.TEST_WEB_URL;
    const { cookie } = await login(baseUrl);
    for (const path of [
      "/api/gradebook?courseId=c-matan",
      "/api/submissions",
      "/api/analytics/course/c-matan",
      "/api/gradebook/me?userId=u-stud-1",
    ])
      assert.equal((await get(baseUrl, path, cookie)).status, 403);
    const response = await fetch(`${baseUrl}/api/tracking/progress`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", Origin: new URL(baseUrl).origin },
      body: JSON.stringify({ userId: "u-stud-1", activityId: "mv1" }),
    });
    assert.equal(response.status, 403);
  });

if (process.env.TEST_WEB_URL) {
  test("Next.js: расписание новой версии работает с серверной группой", async () => {
    const baseUrl = process.env.TEST_WEB_URL;
    const { cookie, user } = await login(baseUrl);
    const path = `/api/schedule?group=${encodeURIComponent(user.group)}`;
    assert.equal((await get(baseUrl, path)).status, 401);
    const response = await get(baseUrl, path, cookie);
    assert.equal(response.status, 200);
    const schedule = await response.json();
    assert.equal(schedule.group, user.group);
    assert.ok(schedule.slots.length > 0);
    assert.equal(
      (await get(baseUrl, `/api/schedule?group=${encodeURIComponent("ЭК-1237")}`, cookie)).status,
      403,
    );
  });

  test("Next.js: редактирование обложки требует серверного права course.edit", async () => {
    const baseUrl = process.env.TEST_WEB_URL;
    const put = (cookie) =>
      fetch(`${baseUrl}/api/courses/c-matan/cover`, {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json", Origin: new URL(baseUrl).origin },
        // Пустой патч проверяет доступ без изменения обложки в демоданных.
        body: "{}",
      });
    assert.equal((await put("")).status, 401);
    const student = await login(baseUrl);
    assert.equal((await put(student.cookie)).status, 403);
    const tutor = await login(baseUrl, "kazarinova@pspu.ru");
    assert.equal((await put(tutor.cookie)).status, 200);
  });
}
