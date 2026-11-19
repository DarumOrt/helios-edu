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
      await t.test("справочник и полномочия организатора действуют в открытой сессии", async () => {
        const facultyCode = "Ф" + unique;
        const sharedCode = code.replace("-123", "-124");
        const path = "/api/faculties/" + encodeURIComponent(facultyCode);
        const scoped = { organizerFaculties: [facultyCode] };
        const organizerPath = "/api/users/" + organizer.user.id;
        let createdGroup;
        let shared;
        let member;
        try {
          assert.equal(
            (await send("POST", "/api/faculties", { code: facultyCode, name: "Факультет пилота" })).status,
            403,
          );
          await expect(
            await send("POST", "/api/faculties", { code: facultyCode, name: "Факультет пилота" }, admin),
            201,
          );
          await expect(await send("PATCH", path, { name: "Факультет практики" }, admin), 200);
          createdGroup = await expect(
            await send("POST", "/api/cohorts", { name: "Ф" + unique, faculty: facultyCode }, admin),
            201,
          );
          shared = await expect(
            await send(
              "POST",
              "/api/courses",
              {
                code: sharedCode,
                title: "Общий курс",
                category: "Практика",
                faculty: "ИНЭК",
                tutorId: tutor.user.id,
                cohortIds: [createdGroup.id, "co-1"],
              },
              admin,
            ),
            201,
          );
          member = (
            await expect(
              await send(
                "POST",
                "/api/users",
                {
                  name: "Студент факультета",
                  email: "faculty-" + unique + "@example.ru",
                  role: "student",
                  group: createdGroup.name,
                },
                admin,
              ),
              201,
            )
          ).user;
          assert.equal((await send("PATCH", organizerPath, scoped)).status, 403);
          await expect(await send("PATCH", organizerPath, scoped, admin), 200);
          const groups = await expect(await get(baseUrl, "/api/cohorts/directory", organizer.cookie), 200);
          assert.deepEqual(
            groups.items.map((g) => g.id),
            [createdGroup.id],
          );
          const users = await expect(await get(baseUrl, "/api/users/directory", organizer.cookie), 200);
          assert.deepEqual(users.items.map((u) => u.id).sort(), [organizer.user.id, member.id].sort());
          const faculties = await expect(await get(baseUrl, "/api/faculties", organizer.cookie), 200);
          assert.deepEqual(
            faculties.map((f) => f.code),
            [facultyCode],
          );
          assert.equal((await get(baseUrl, "/api/cohorts/co-1", organizer.cookie)).status, 404);
          assert.equal((await send("PATCH", "/api/users/u-stud-2", { name: "Чужая запись" })).status, 404);
          assert.equal(
            (await send("POST", "/api/cohorts", { name: "Чужая группа", faculty: "ИНЭК" })).status,
            400,
          );
          assert.equal((await get(baseUrl, "/api/courses/" + shared.id, organizer.cookie)).status, 200);
          assert.equal(
            (await send("PATCH", "/api/courses/" + shared.id, { title: "Общий курс" })).status,
            404,
          );
          assert.equal(
            (await send("PUT", "/api/courses/" + shared.id + "/enrollment/key", { keyword: "пример" }))
              .status,
            404,
          );
          const roster = await expect(
            await get(baseUrl, "/api/courses/" + shared.id + "/enrollment", organizer.cookie),
            200,
          );
          assert.deepEqual(roster.cohortIds, [createdGroup.id]);
          assert.deepEqual(
            roster.students.map((s) => s.id),
            [member.id],
          );
          assert.equal(
            (await get(baseUrl, "/api/courses/" + shared.id + "/enrollment/students?q=ст", organizer.cookie))
              .status,
            404,
          );
          const grades = await expect(
            await get(baseUrl, "/api/gradebook?courseId=" + shared.id, organizer.cookie),
            200,
          );
          assert.deepEqual(
            grades.map((g) => g.userId),
            [member.id],
          );
          await expect(await send("PATCH", "/api/users/" + member.id, { name: "Студент практики" }), 200);
          assert.equal((await send("DELETE", path, undefined, admin)).status, 409);
          await expect(await send("PATCH", path, { archived: true }, admin), 200);
          assert.equal(
            (await send("POST", "/api/cohorts", { name: "Архивная", faculty: facultyCode }, admin)).status,
            400,
          );
        } finally {
          await send("PATCH", organizerPath, { organizerFaculties: null }, admin);
          if (shared) {
            await send("PATCH", "/api/courses/" + shared.id, { cohortIds: [] }, admin);
            await send("DELETE", "/api/courses/" + shared.id, undefined, admin);
          }
          if (member) await send("DELETE", "/api/users/" + member.id, undefined, admin);
          if (createdGroup) await send("DELETE", "/api/cohorts/" + createdGroup.id, undefined, admin);
          assert.equal((await send("DELETE", path, undefined, admin)).status, 204);
        }
      });

      await t.test("права, запрет собственной роли и блокировки, CSRF", async () => {
        for (const actor of [student, tutor])
          for (const path of ["/api/users", "/api/cohorts", "/api/courses"])
            assert.equal(
              (await send("POST", path, {}, actor)).status,
              actor === tutor && path === "/api/courses" ? 400 : 403,
            );
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
          await send("POST", "/api/users", {
            name: "Организатор Тест",
            email: `${unique}@example.ru`,
            role: "organizer",
          }),
          400,
          "role",
          "Эту роль может назначить только администратор",
        );
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

      await t.test("списки управления фильтруются, сортируются и ограничивают страницу", async () => {
        for (const path of ["/api/cohorts/directory", "/api/users/directory"]) {
          assert.equal((await get(baseUrl, path, student.cookie)).status, 403);
          assert.equal((await get(baseUrl, path, tutor.cookie)).status, 403);
        }
        const groupList = await expect(
          await get(
            baseUrl,
            "/api/cohorts/directory?occupancy=occupied&sort=most-students",
            organizer.cookie,
          ),
          200,
        );
        assert.ok(groupList.items.some((g) => g.name === "М1227"));
        assert.ok(
          groupList.items.every(
            (g, index, items) => g.students > 0 && (!index || g.students <= items[index - 1].students),
          ),
        );
        const search = await expect(
          await get(baseUrl, `/api/cohorts/directory?q=${encodeURIComponent("м1227")}`, admin.cookie),
          200,
        );
        assert.deepEqual(
          search.items.map((g) => g.name),
          ["М1227"],
        );
        const users = await expect(
          await get(baseUrl, "/api/users/directory?role=student&sort=newest&page=1", organizer.cookie),
          200,
        );
        assert.equal(users.page, 1);
        assert.equal(users.items.length, Math.min(25, users.total));
        assert.ok(users.items.every((u) => u.role === "student"));
        const second = await expect(
          await get(baseUrl, "/api/users/directory?role=student&sort=newest&page=2", organizer.cookie),
          200,
        );
        assert.equal(second.page, users.total > 25 ? 2 : 1);
        if (second.page === 2)
          assert.ok(!second.items.some((u) => users.items.some((other) => other.id === u.id)));

        const groups = [];
        try {
          const before = await expect(await get(baseUrl, "/api/cohorts/directory", organizer.cookie), 200);
          for (let index = 0; index < Math.max(0, 26 - before.total); index++) {
            const created = await expect(
              await send("POST", "/api/cohorts", {
                name: `П${unique}${index}`,
                faculty: "МФ",
              }),
              201,
            );
            groups.push(created.id);
          }
          const first = await expect(await get(baseUrl, "/api/cohorts/directory", organizer.cookie), 200);
          const next = await expect(
            await get(baseUrl, "/api/cohorts/directory?page=2", organizer.cookie),
            200,
          );
          assert.equal(first.items.length, 25);
          assert.equal(next.page, 2);
          assert.ok(
            next.items.length > 0 && !next.items.some((g) => first.items.some((other) => other.id === g.id)),
          );
        } finally {
          for (const id of groups) await send("DELETE", `/api/cohorts/${id}`);
        }
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
        // преподаватель правит карточку своего курса, но не поля управления; чужой курс ему не виден
        const own = await expect(
          await send(
            "PATCH",
            `/api/courses/${course.id}`,
            { title: "Свой курс", description: "Новое" },
            tutor,
          ),
          200,
        );
        assert.deepEqual([own.title, own.description], ["Свой курс", "Новое"]);
        for (const field of ["tutorId", "academicYear"]) {
          const denied = await expect(
            await send("PATCH", `/api/courses/${course.id}`, { [field]: null }, tutor),
            403,
          );
          assert.equal(denied.error, "Преподавателя и учебный год курса меняет организатор");
        }
        const stranger = await login(baseUrl, "tutor2@pspu.ru");
        assert.equal(
          (await send("PATCH", `/api/courses/${course.id}`, { title: "Чужой" }, stranger)).status,
          404,
        );
        assert.equal(
          (await send("PATCH", `/api/courses/${course.id}`, { title: "Попытка" }, student)).status,
          403,
        );
        await expect(
          await patchCourse(course.id, { status: "published" }),
          400,
          "faculty",
          "Для публикации выберите факультет",
        );
        await expect(await send("PATCH", `/api/courses/${course.id}`, { faculty: "ИНЭК" }, tutor), 200);
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
