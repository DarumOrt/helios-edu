import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { apiUrl, get, login } from "./client.mjs";

for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: управление пользователями, группами и курсами P1`, async (t) => {
    const organizer = await login(baseUrl, "organizer@pspu.ru");
    const admin = await login(baseUrl, "admin@pspu.ru");
    const student = await login(baseUrl);
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const unique = `${Date.now()}${randomBytes(2).toString("hex")}`;
    const code = `${[...randomBytes(6)].map((byte) => String.fromCharCode(65 + (byte % 26))).join("")}-123`;
    const send = (method, path, body, actor = organizer, client = true) =>
      fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Cookie: actor.cookie,
          Origin: client ? new URL(baseUrl).origin : "https://other.example",
          "Content-Type": "application/json",
          ...(client ? { "X-Helios-Client": "web" } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10_000),
      });
    const expect = async (response, status, field, message) => {
      const body = await response.json();
      assert.equal(response.status, status, JSON.stringify(body));
      if (field) assert.equal(body.fields[field], message);
      return body;
    };
    const patchUser = (id, patch, actor) => send("PATCH", `/api/users/${id}`, patch, actor);
    const patchCourse = (id, patch) => send("PATCH", `/api/courses/${id}`, patch);
    const patchGroup = (id, patch) => send("PATCH", `/api/cohorts/${id}`, patch);
    const groupBefore = await (await get(baseUrl, "/api/cohorts/co-1", organizer.cookie)).json();
    let createdUser;
    let group;
    let course;
    let credentials;
    try {
      await t.test("права, запрет собственной роли и блокировки, CSRF", async () => {
        for (const actor of [student, tutor])
          for (const path of ["/api/users", "/api/cohorts", "/api/courses"])
            assert.equal((await send("POST", path, {}, actor)).status, 403);
        assert.equal((await get(baseUrl, "/api/cohorts", student.cookie)).status, 403);
        assert.equal((await get(baseUrl, "/api/cohorts", tutor.cookie)).status, 200);
        await expect(
          await send("POST", "/api/users", {
            name: "Админ Тест",
            email: `${unique}@example.ru`,
            role: "admin",
          }),
          400,
          "role",
          "Эту роль может назначить только администратор",
        );
        await expect(await patchUser("u-admin", { name: "Другое Имя" }), 403);
        await expect(
          await patchUser(organizer.user.id, { role: "student" }),
          400,
          "role",
          "Свою роль изменить нельзя",
        );
        await expect(
          await patchUser(organizer.user.id, { status: "blocked" }),
          400,
          "status",
          "Себя заблокировать нельзя",
        );
        // Next сам добавляет X-Helios-Client при пересылке; этот контракт проверяем у C#.
        for (const [method, path, body] of name === "C#"
          ? [
              ["POST", "/api/users", {}],
              ["PATCH", "/api/users/u-stud-2", {}],
              ["POST", "/api/cohorts", {}],
              ["PATCH", "/api/cohorts/co-1", {}],
              ["PUT", "/api/cohorts/co-1/members", { memberIds: [] }],
              ["DELETE", "/api/cohorts/co-1"],
              ["POST", "/api/courses", {}],
              ["PATCH", "/api/courses/c-dor-ai", {}],
            ]
          : [])
          assert.equal((await send(method, path, body, organizer, false)).status, 403, `${method} ${path}`);
      });

      await t.test("создание, каноническая группа, временный пароль и дубликат почты", async () => {
        credentials = await expect(
          await send("POST", "/api/users", {
            name: "  Проверка Студент  ",
            email: `${unique}@example.ru`,
            role: "student",
            group: "м1217",
            faculty: " ИНЭК ",
            status: "blocked",
          }),
          201,
        );
        createdUser = credentials.user;
        assert.equal(createdUser.group, "М1217");
        assert.equal(createdUser.name, "Проверка Студент");
        assert.equal(createdUser.status, "active");
        assert.match(credentials.temporaryPassword, /^[A-HJ-NP-Za-km-z2-9]{12}$/);
        assert.ok(!("passwordHash" in createdUser));
        assert.equal(
          (await login(baseUrl, createdUser.email, credentials.temporaryPassword)).user.id,
          createdUser.id,
        );
        await expect(
          await send("POST", "/api/users", {
            name: "Дубликат",
            email: createdUser.email.toUpperCase(),
            role: "student",
          }),
          409,
          "email",
          "Эта почта уже зарегистрирована",
        );
        await expect(
          await patchUser(createdUser.id, { email: "ADMIN@PSPU.RU" }),
          409,
          "email",
          "Эта почта уже зарегистрирована",
        );
        await expect(
          await patchUser(createdUser.id, { group: "НетГруппы" }),
          400,
          "group",
          "Такой группы нет",
        );
        await expect(
          await patchUser(createdUser.id, { name: " ", email: "bad", status: "unknown" }),
          400,
          "name",
          "Укажите имя и фамилию — от 2 до 100 символов",
        );
        const cleared = await expect(await patchUser(createdUser.id, { faculty: null }), 200);
        assert.equal(cleared.group, "М1217");
        assert.ok(!("faculty" in cleared));
      });

      await t.test("валидация возвращает точные тексты полей, неизвестные объекты — 404", async () => {
        for (const [patch, field, message] of [
          [{ email: "bad" }, "email", "Почта выглядит неполной, например name@pspu.ru"],
          [{ role: "unknown" }, "role", "Выберите роль"],
          [{ status: null }, "status", "Неизвестный статус"],
          [{ faculty: "я".repeat(51) }, "faculty", "Факультет — до 50 символов"],
        ])
          await expect(await patchUser(createdUser.id, patch), 400, field, message);
        for (const [input, field, message] of [
          [{ name: "!" }, "name", "Название — от 2 до 30 символов: буквы, цифры, дефис, например М1227"],
          [{ name: `В-${unique}`, faculty: "я".repeat(51) }, "faculty", "Факультет — до 50 символов"],
        ])
          await expect(await send("POST", "/api/cohorts", input), 400, field, message);
        const valid = {
          code,
          title: "Проверочный курс",
          category: "Тесты",
          description: "",
          tutorId: tutor.user.id,
        };
        for (const [patch, field, message] of [
          [{ code: "bad" }, "code", "Код — заглавные буквы, дефис и три цифры, например МАТ-101"],
          [{ title: " " }, "title", "Название — от 3 до 120 символов"],
          [{ category: " " }, "category", "Укажите направление, например Математика"],
          [{ description: "я".repeat(1001) }, "description", "Описание — до 1000 символов"],
          [{ tutorId: "" }, "tutorId", "Назначьте преподавателя"],
          [{ tutorId: "unknown" }, "tutorId", "Выберите преподавателя"],
        ])
          await expect(await send("POST", "/api/courses", { ...valid, ...patch }), 400, field, message);
        for (const path of ["/api/users/missing", "/api/cohorts/missing", "/api/courses/missing"])
          assert.equal((await send("PATCH", path, {})).status, 404);
        const missing = await get(baseUrl, "/api/cohorts/missing", organizer.cookie);
        assert.deepEqual(await expect(missing, 404), { error: "not found" });
      });

      await t.test("блокировка отзывает все сессии, пароль проверяется раньше статуса", async () => {
        const sessions = [
          await login(baseUrl, createdUser.email, credentials.temporaryPassword),
          await login(baseUrl, createdUser.email, credentials.temporaryPassword),
        ];
        await expect(await patchUser(createdUser.id, { status: "blocked" }), 200);
        for (const session of sessions)
          assert.equal((await get(baseUrl, "/api/auth/me", session.cookie)).status, 401);
        const attempt = (password) => send("POST", "/api/auth/login", { email: createdUser.email, password });
        await expect(await attempt("WrongPassword"), 401);
        const blocked = await expect(await attempt(credentials.temporaryPassword), 403);
        assert.equal(blocked.error, "Учётная запись заблокирована. Обратитесь к организатору.");
        await expect(await patchUser(createdUser.id, { status: "active" }), 200);
        assert.equal(
          (await login(baseUrl, createdUser.email, credentials.temporaryPassword)).user.status,
          "active",
        );
        for (const session of sessions)
          assert.equal((await get(baseUrl, "/api/auth/me", session.cookie)).status, 401);
      });

      await t.test("курс: черновик, публикация, группа, архив и собственный преподаватель", async () => {
        const input = {
          code: code.toLowerCase(),
          title: "  Проверочный курс  ",
          category: "Тесты",
          description: " Описание ",
          tutorId: tutor.user.id,
        };
        course = await expect(await send("POST", "/api/courses", input), 201);
        assert.equal(course.code, code);
        assert.equal(course.status, "draft");
        assert.equal(course.enrolled, 0);
        assert.ok(["sky", "teal", "apricot", "iris", "sun", "rose"].includes(course.coverColor));
        assert.ok(!("sections" in course));
        await expect(await send("POST", "/api/courses", input), 409, "code", "Курс с таким кодом уже есть");
        await expect(await patchCourse(course.id, { code }), 400, "code", "Код курса изменить нельзя");
        await expect(
          await patchCourse(course.id, { tutorId: student.user.id }),
          400,
          "tutorId",
          "Выберите преподавателя",
        );
        await expect(await patchCourse(course.id, { status: "bad" }), 400, "status", "Неизвестный статус");
        assert.equal(
          (await send("PATCH", `/api/courses/${course.id}`, { title: "Попытка" }, tutor)).status,
          403,
        );
        for (const status of ["draft", "published", "archived"]) {
          const changed = await expect(await patchCourse(course.id, { status }), 200);
          assert.equal(changed.coverColor, course.coverColor);
          assert.equal((await get(baseUrl, `/api/courses/${course.id}`, tutor.cookie)).status, 200);
          assert.equal((await get(baseUrl, `/api/courses/${course.id}`, student.cookie)).status, 404);
        }
        await expect(await patchCourse(course.id, { status: "published" }), 200);
        await expect(
          await patchGroup("co-1", { courseIds: [...groupBefore.courseIds, course.id, course.id] }),
          200,
        );
        assert.equal((await get(baseUrl, `/api/courses/${course.id}`, student.cookie)).status, 200);
        assert.ok(
          (await (await get(baseUrl, "/api/courses", student.cookie)).json()).some(
            (item) => item.id === course.id,
          ),
        );
        await expect(await patchCourse(course.id, { status: "draft" }), 200);
        assert.equal((await get(baseUrl, `/api/courses/${course.id}`, student.cookie)).status, 404);
        const outsider = await login(baseUrl, "student4@student.pspu.ru");
        assert.deepEqual(await (await get(baseUrl, "/api/courses", outsider.cookie)).json(), []);
      });

      await t.test("группа: дубликаты, состав, перевод, переименование, удаление", async () => {
        group = await expect(
          await send("POST", "/api/cohorts", { name: `Т-${unique}`, faculty: "ИНЭК" }),
          201,
        );
        await expect(
          await send("POST", "/api/cohorts", { name: group.name.toLowerCase() }),
          409,
          "name",
          "Группа с таким названием уже есть",
        );
        await expect(
          await patchGroup(group.id, { courseIds: ["unknown"] }),
          400,
          "courseIds",
          "Есть неизвестные курсы",
        );
        await expect(
          await send("PUT", `/api/cohorts/${group.id}/members`, { memberIds: [tutor.user.id] }),
          400,
          "memberIds",
          "В группу можно добавить только студентов",
        );
        await expect(
          await send("PUT", `/api/cohorts/${group.id}/members`, { memberIds: "bad" }),
          400,
          "memberIds",
          "Передайте список id студентов",
        );
        const members = await expect(
          await send("PUT", `/api/cohorts/${group.id}/members`, {
            memberIds: [createdUser.id, createdUser.id],
          }),
          200,
        );
        assert.deepEqual(members.memberIds, [createdUser.id]);
        assert.ok(
          !(await (await get(baseUrl, "/api/cohorts/co-1", organizer.cookie)).json()).memberIds.includes(
            createdUser.id,
          ),
        );
        const renamed = await expect(await patchGroup(group.id, { name: `П-${unique}`, faculty: null }), 200);
        assert.deepEqual(renamed.memberIds, [createdUser.id]);
        assert.ok(!("faculty" in renamed));
        const users = await (await get(baseUrl, "/api/users", organizer.cookie)).json();
        assert.equal(users.find((user) => user.id === createdUser.id).group, renamed.name);
        await expect(await send("DELETE", `/api/cohorts/${group.id}`), 409);
        const promoted = await expect(await patchUser(createdUser.id, { role: "tutor" }), 200);
        assert.ok(!("group" in promoted));
        await expect(
          await patchUser(createdUser.id, { group: renamed.name }),
          400,
          "group",
          "Группу можно назначить только студенту",
        );
        await expect(await patchUser(createdUser.id, { role: "student", group: renamed.name }), 200);
        await expect(await send("PUT", `/api/cohorts/${group.id}/members`, { memberIds: [] }), 200);
        assert.equal((await send("DELETE", `/api/cohorts/${group.id}`)).status, 204);
        assert.equal((await get(baseUrl, `/api/cohorts/${group.id}`, organizer.cookie)).status, 404);
        group = null;
      });

      await t.test("администратор может назначить admin, организатор — нет", async () => {
        await expect(await patchUser(createdUser.id, { role: "admin" }, admin), 200);
        assert.equal((await patchUser(createdUser.id, { name: "Попытка" })).status, 403);
        await expect(await patchUser(createdUser.id, { role: "student" }, admin), 200);
      });
    } finally {
      await expect(await patchGroup("co-1", { courseIds: groupBefore.courseIds }), 200);
      if (createdUser)
        await expect(
          await patchUser(createdUser.id, { role: "student", group: null, status: "active" }, admin),
          200,
        );
      if (group) assert.equal((await send("DELETE", `/api/cohorts/${group.id}`)).status, 204);
      if (course) await expect(await patchCourse(course.id, { status: "draft" }), 200);
    }
    // Учетные записи тестов не должны менять состав сидовых групп.
    const restored = await (await get(baseUrl, "/api/cohorts/co-1", organizer.cookie)).json();
    assert.deepEqual(restored, groupBefore);
  });
}
