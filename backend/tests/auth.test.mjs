import assert from "node:assert/strict";
import { test } from "node:test";
import { apiUrl, login, get, demoPassword } from "./client.mjs";

for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: без сессии курсы, профиль и пользователи недоступны`, async () => {
    for (const path of ["/api/auth/me", "/api/courses", "/api/courses/c-dor-ai", "/api/users"])
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
      body: JSON.stringify({ email: "student@student.pspu.ru", password: "wrong-password" }),
    });
    assert.equal(response.status, 401);
    const crossSite = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://other.example" },
      body: JSON.stringify({ email: "student@student.pspu.ru", password: "irrelevant" }),
    });
    assert.equal(crossSite.status, 403);
  });

  test(`${name}: роль берётся с сервера; список пользователей доступен только организатору и администратору`, async () => {
    for (const [email, role, status] of [
      ["student@student.pspu.ru", "student", 403],
      ["tutor@pspu.ru", "tutor", 403],
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
    assert.ok(classmates.every((member) => member.group === user.group));
    // почту и роль одногруппников студент не получает
    assert.ok(
      classmates.every(
        (member) => !("email" in member) && !("role" in member) && !("passwordHash" in member),
      ),
    );
    assert.equal((await get(baseUrl, `${prefix}?group=${encodeURIComponent("1237")}`, cookie)).status, 403);
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
        email: "student@student.pspu.ru",
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

  test(`${name}: закрытая регистрация, очередь без роли и отклонение`, async () => {
    const admin = await login(baseUrl, "admin@pspu.ru");
    const organizer = await login(baseUrl, "organizer@pspu.ru");
    const send = (method, path, body, cookie = admin.cookie) =>
      fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-Helios-Client": "web",
          Origin: new URL(baseUrl).origin,
        },
        ...(body && { body: JSON.stringify(body) }),
      });
    const email = `pending-${crypto.randomUUID()}@example.ru`;
    const valid = { name: "  Новый Студент ", email, consent: true };
    assert.equal((await (await get(baseUrl, "/api/settings")).json()).allowRegistration, false);
    assert.equal((await register(valid)).status, 403);
    assert.equal((await send("PUT", "/api/settings", { allowRegistration: true })).status, 200);
    try {
      for (const [patch, field] of [
        [{ name: " " }, "name"],
        [{ email: "not-an-email" }, "email"],
        [{ consent: false }, "consent"],
      ]) {
        const response = await register({ ...valid, ...patch });
        assert.equal(response.status, 400, field);
        assert.ok((await response.json()).fields[field], field);
      }
      assert.equal((await register(valid, "https://other.example")).status, 403);
      const response = await register({ ...valid, role: "admin", group: "М1217", password: demoPassword });
      assert.equal(response.status, 202);
      assert.deepEqual(response.headers.getSetCookie(), []);
      assert.deepEqual(await response.json(), { status: "pending" });
      const duplicate = await register({ ...valid, email: email.toUpperCase() });
      assert.equal(duplicate.status, 409);
      assert.ok((await duplicate.json()).fields.email);
      assert.equal(
        (await send("POST", "/api/auth/login", { email, password: demoPassword }, "")).status,
        401,
      );

      const path = `/api/users/directory?role=pending&q=${encodeURIComponent(email)}`;
      assert.equal((await get(baseUrl, path)).status, 401);
      const queue = await (await get(baseUrl, path, organizer.cookie)).json();
      assert.equal(queue.pendingCount, 1);
      assert.equal(queue.total, 1);
      const [application] = queue.items;
      assert.equal(application.name, "Новый Студент");
      assert.equal(application.status, "pending");
      assert.ok(!("role" in application) && !("group" in application) && !("passwordHash" in application));
      assert.ok(application.createdAt);
      assert.ok(
        !(await (await get(baseUrl, "/api/users", admin.cookie)).json()).some(
          (user) => user.id === application.id,
        ),
      );
      const approval = `/api/users/${application.id}/application`;
      assert.equal((await send("POST", approval, { role: "organizer" }, organizer.cookie)).status, 400);
      assert.equal((await send("PATCH", `/api/users/${application.id}`, { role: "student" })).status, 409);
      assert.equal((await send("DELETE", approval, undefined, organizer.cookie)).status, 204);
      assert.equal((await (await get(baseUrl, path, admin.cookie)).json()).total, 0);
      assert.equal((await send("POST", approval, { role: "student" })).status, 409);
    } finally {
      assert.equal((await send("PUT", "/api/settings", { allowRegistration: false })).status, 200);
    }
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
      "/api/gradebook?courseId=c-dor-ai",
      "/api/submissions",
      "/api/analytics/course/c-dor-ai",
    ])
      assert.equal((await get(baseUrl, path, cookie)).status, 403);
    // свои оценки: ученик берётся из сессии, чужой userId в адресе ничего не меняет
    assert.equal((await get(baseUrl, "/api/gradebook/me?userId=u-stud-1", cookie)).status, 200);
    const response = await fetch(`${baseUrl}/api/tracking/progress`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", Origin: new URL(baseUrl).origin },
      body: JSON.stringify({ userId: "u-stud-1", activityId: "mv1" }),
    });
    // трекинг проверяет C#: без курса — 404; чужой userId он не использует (см. tracking.test.mjs)
    assert.equal(response.status, 404);
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
      (await get(baseUrl, `/api/schedule?group=${encodeURIComponent("1237")}`, cookie)).status,
      403,
    );
    // без группы — 400, как в демо
    assert.equal((await get(baseUrl, "/api/schedule", cookie)).status, 400);
  });

  test("Next.js: редактирование обложки требует серверного права course.edit", async () => {
    const baseUrl = process.env.TEST_WEB_URL;
    const put = (cookie) =>
      fetch(`${baseUrl}/api/courses/c-dor-ai/cover`, {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json", Origin: new URL(baseUrl).origin },
        // Пустой патч проверяет доступ без изменения обложки в демоданных.
        body: "{}",
      });
    assert.equal((await put("")).status, 401);
    const student = await login(baseUrl);
    assert.equal((await put(student.cookie)).status, 403);
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    assert.equal((await put(tutor.cookie)).status, 200);

    // пересылка в C# сама добавляет X-Helios-Client — поэтому изменения без своего Origin Next отклоняет
    const remove = (origin) =>
      fetch(`${baseUrl}/api/courses/c-dor-ai/skills/no-such-skill`, {
        method: "DELETE",
        headers: { Cookie: tutor.cookie, ...(origin && { Origin: origin }) },
      });
    assert.equal((await remove()).status, 403);
    assert.equal((await remove("https://other.example")).status, 403);
    assert.equal((await remove(new URL(baseUrl).origin)).status, 404);
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
    const { cookie } = await login(baseUrl, "tutor@pspu.ru");
    // свой курс — доступен; несуществующий (или чужой) — как в C#, не найден
    assert.equal((await get(baseUrl, "/api/analytics/course/c-dor-ai", cookie)).status, 200);
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

if (process.env.TEST_WEB_URL)
  test("Next.js: тесты, задания и объявления курса — по правам и без утечки ответов", async () => {
    const baseUrl = process.env.TEST_WEB_URL;
    const origin = new URL(baseUrl).origin;
    const send = (cookie, method, path, body) =>
      fetch(`${baseUrl}${path}`, {
        method,
        headers: { Cookie: cookie, "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify(body),
      });
    const student = await login(baseUrl);
    const tutor = await login(baseUrl, "tutor@pspu.ru");

    // вопросы теста (P5): ученику — без правильных ответов и подсказок, менять их может только преподаватель
    const questionsPath = "/api/courses/c-dor-ai/quizzes/mq1/questions";
    const quiz = await get(baseUrl, questionsPath, student.cookie);
    assert.equal(quiz.status, 200);
    const questions = await quiz.json();
    assert.ok(questions.length > 0 && questions.every((q) => !("correct" in q) && !("hints" in q)));
    assert.equal((await send(student.cookie, "PUT", questionsPath, { questions })).status, 403);
    const full = await get(baseUrl, questionsPath, tutor.cookie);
    assert.equal(full.status, 200);
    assert.ok((await full.json()).every((q) => "correct" in q));

    // сданное задание появляется у преподавателя; автор — из сессии, чужой userId в теле игнорируется
    const text = `Ответ ${Date.now()}`;
    const submitted = await send(student.cookie, "POST", "/api/assignment/ma1/submit", {
      courseId: "c-dor-ai",
      userId: "u-stud-1",
      text,
    });
    assert.equal(submitted.status, 201);
    const { items } = await (await get(baseUrl, "/api/submissions", tutor.cookie)).json();
    const mine = items.find((s) => s.text === text && s.courseId === "c-dor-ai");
    assert.equal(mine?.userId, student.user.id);

    // объявление пишет преподаватель, получает студент курса
    const announcement = { title: `Объявление ${Date.now()}`, body: "Консультация в пятницу" };
    assert.equal(
      (await send(student.cookie, "POST", "/api/courses/c-dor-ai/announcements", announcement)).status,
      403,
    );
    assert.equal(
      (await send(tutor.cookie, "POST", "/api/courses/c-dor-ai/announcements", announcement)).status,
      201,
    );
    const notifications = await (await get(baseUrl, "/api/notifications", student.cookie)).json();
    assert.ok(notifications.some((n) => n.title.endsWith(announcement.title) && n.read === false));
  });
