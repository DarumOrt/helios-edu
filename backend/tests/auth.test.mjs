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

  // Чужой сайт не может добавить X-Helios-Client без CORS preflight — поэтому без него.
  const register = (body, origin = new URL(baseUrl).origin) =>
    fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(origin === new URL(baseUrl).origin ? { "X-Helios-Client": "web" } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

  test(`${name}: регистрация создаёт студента без группы и сразу открывает сессию`, async () => {
    const email = `new-${name === "C#" ? "api" : "web"}-${Date.now()}@example.ru`;
    const password = "Учёба2026";
    // role и group в теле игнорируются: сам регистрируется только студент без группы
    const response = await register({
      name: "  Новый Студент ",
      email,
      password,
      consent: true,
      role: "admin",
      group: "М1217",
    });
    assert.equal(response.status, 201);
    const cookie = response.headers.getSetCookie().find((c) => c.startsWith("helios-auth="));
    assert.ok(cookie);
    assert.match(cookie, /httponly/i);
    const user = await response.json();
    assert.equal(user.name, "Новый Студент");
    assert.equal(user.email, email);
    assert.equal(user.role, "student");
    assert.ok(!("group" in user) && !("passwordHash" in user));

    const session = cookie.split(";")[0];
    assert.deepEqual(await (await get(baseUrl, "/api/auth/me", session)).json(), user);
    // курсов нет, пока организатор не зачислит в группу
    assert.deepEqual(await (await get(baseUrl, "/api/courses", session)).json(), []);
    assert.equal((await login(baseUrl, email.toUpperCase(), password)).user.id, user.id);

    const duplicate = await register({ name: "Другой", email, password, consent: true });
    assert.equal(duplicate.status, 409);
    assert.ok((await duplicate.json()).fields.email);
  });

  test(`${name}: регистрация проверяет поля и источник запроса`, async () => {
    const valid = {
      name: "Проверка Полей",
      email: `fields-${Date.now()}@example.ru`,
      password: "Пароль2026",
      consent: true,
    };
    for (const [patch, field] of [
      [{ name: " " }, "name"],
      [{ email: "not-an-email" }, "email"],
      [{ password: "кот12" }, "password"],
      [{ password: "безцифрвообще" }, "password"],
      [{ consent: false }, "consent"],
    ]) {
      const response = await register({ ...valid, ...patch });
      assert.equal(response.status, 400, field);
      assert.ok((await response.json()).fields[field], field);
    }
    assert.equal((await register(valid, "https://other.example")).status, 403);
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

if (process.env.TEST_WEB_URL)
  test("Next.js: переключатель «Демо / Сервер» меняет источник данных только для своего браузера", async () => {
    const baseUrl = process.env.TEST_WEB_URL;
    const origin = new URL(baseUrl).origin;
    const toggle = (source, from = origin, cookie = "") =>
      fetch(`${baseUrl}/api/data-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: from, ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify({ source }),
      });

    assert.deepEqual(await (await get(baseUrl, "/api/data-source")).json(), {
      source: "server",
      serverAvailable: true,
      demoAllowed: true,
    });
    assert.equal((await toggle("demo", "https://other.example")).status, 403);
    assert.equal((await toggle("cloud")).status, 400);

    const demo = await toggle("demo");
    assert.equal(demo.status, 200);
    const cookie = demo.headers.getSetCookie().find((c) => c.startsWith("helios-data-source="));
    assert.match(cookie, /httponly/i);
    const demoCookie = cookie.split(";")[0];
    // демо: моки без входа, кабинет открывается без редиректа на /login
    const courses = await get(baseUrl, "/api/courses", demoCookie);
    assert.equal(courses.status, 200);
    assert.ok((await courses.json()).length > 0);
    assert.equal(
      (await fetch(`${baseUrl}/dashboard`, { headers: { Cookie: demoCookie }, redirect: "manual" })).status,
      200,
    );

    const back = await toggle("server", origin, demoCookie);
    assert.equal(back.status, 200);
    const serverCookie = back.headers
      .getSetCookie()
      .find((c) => c.startsWith("helios-data-source="))
      .split(";")[0];
    assert.equal((await get(baseUrl, "/api/courses", serverCookie)).status, 401);
  });

if (process.env.TEST_WEB_URL)
  test("Next.js: курс из пути проверяется — аналитика и проверка работ только по видимым курсам", async () => {
    const baseUrl = process.env.TEST_WEB_URL;
    const { cookie } = await login(baseUrl, "kazarinova@pspu.ru");
    // свой курс — доступен; несуществующий (или чужой) — как в C#, не найден
    assert.equal((await get(baseUrl, "/api/analytics/course/c-matan", cookie)).status, 200);
    assert.equal((await get(baseUrl, "/api/analytics/course/no-such-course", cookie)).status, 404);
    assert.equal((await get(baseUrl, "/api/analytics/lesson/no-such-activity", cookie)).status, 404);

    const list = await get(baseUrl, "/api/submissions", cookie);
    assert.equal(list.status, 200);
    const { items } = await list.json();
    assert.ok(items.length > 0);
    const review = (id, body) =>
      fetch(`${baseUrl}/api/submissions/${id}/review`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json", Origin: new URL(baseUrl).origin },
        body: JSON.stringify(body),
      });
    assert.equal((await review("no-such-submission", { grade: 50 })).status, 404);
    // оценка вне шкалы работы не сохраняется
    const tooHigh = await review(items[0].id, { grade: items[0].maxGrade + 1, feedback: "" });
    assert.equal(tooHigh.status, 400);
    assert.ok((await tooHigh.json()).fields.grade);
  });
