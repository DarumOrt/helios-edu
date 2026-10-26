import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { apiUrl, get, login } from "./client.mjs";

for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: конструктор на отдельном курсе P2`, async (t) => {
    const organizer = await login(baseUrl, "organizer@pspu.ru");
    const admin = await login(baseUrl, "admin@pspu.ru");
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const student = await login(baseUrl);
    const unique = `${Date.now()}-${randomBytes(3).toString("hex")}`;
    const send = (method, path, body, actor = tutor, client = true) =>
      fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Cookie: actor.cookie,
          Origin: new URL(baseUrl).origin,
          "Content-Type": "application/json",
          ...(client ? { "X-Helios-Client": "web" } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10_000),
      });
    const expect = async (response, status, field, message) => {
      const body = response.status === 204 ? null : await response.json();
      assert.equal(response.status, status, JSON.stringify(body));
      if (field) assert.equal(body.fields[field], message);
      return body;
    };
    const other = await expect(
      await send(
        "POST",
        "/api/users",
        {
          name: "Другой Преподаватель",
          email: `builder-${unique}@example.ru`,
          role: "tutor",
        },
        organizer,
      ),
      201,
    );
    const foreign = await login(baseUrl, other.user.email, other.temporaryPassword);
    const code = `${[...randomBytes(6)].map((byte) => String.fromCharCode(65 + (byte % 26))).join("")}-202`;
    const course = await expect(
      await send(
        "POST",
        "/api/courses",
        {
          code,
          title: `Конструктор ${unique}`,
          category: "Проверки",
          description: "Только тестовые материалы",
          tutorId: tutor.user.id,
        },
        organizer,
      ),
      201,
    );
    const root = `/api/courses/${course.id}`;
    const detail = async () => expect(await get(baseUrl, root, tutor.cookie), 200);
    const addSection = async (title, actor) =>
      expect(await send("POST", `${root}/sections`, { title }, actor), 201);
    const addActivity = async (section, body) =>
      expect(await send("POST", `${root}/sections/${section.id}/activities`, body), 201);
    const patch = (activity, body, actor) => send("PATCH", `${root}/activities/${activity.id}`, body, actor);
    let first;
    let second;
    let activities;
    const due = "2026-11-15T18:45:30+05:00";

    await t.test("модули: создание, переименование, преподаватель и администраторы", async () => {
      first = await addSection("  Первый модуль  ");
      second = await addSection("Второй модуль", organizer);
      assert.match(first.id, /^s-[a-f0-9]{8}$/);
      assert.equal(first.title, "Первый модуль");
      assert.equal(first.order, 1);
      assert.deepEqual(first.activities, []);
      assert.equal(second.order, 2);
      const renamed = await expect(
        await send("PATCH", `${root}/sections/${second.id}`, { title: "Модуль назначения" }, admin),
        200,
      );
      assert.equal(renamed.title, "Модуль назначения");
      await expect(
        await send("PATCH", `${root}/sections/${first.id}`, { title: " " }),
        400,
        "title",
        "Название модуля — от 2 до 120 символов",
      );
      await expect(
        await send("POST", `${root}/sections`, { title: "я".repeat(121) }),
        400,
        "title",
        "Название модуля — от 2 до 120 символов",
      );
    });

    await t.test("все пять типов, поля по типу и оценка по умолчанию", async () => {
      activities = [];
      for (const input of [
        {
          type: "video",
          title: "Видео",
          src: " /media/demo.mp4 ",
          durationMin: 20,
          maxGrade: 0,
          due: "bad",
          pages: 999,
        },
        { type: "pdf", title: "Документ", pages: 12, src: "/media/demo.pdf", description: "я".repeat(5000) },
        { type: "presentation", title: "Презентация", pages: 15, src: "https://example.ru/slides.pdf" },
        { type: "quiz", title: "Тест", due, durationMin: 30 },
        { type: "assignment", title: "Задание", due, description: "  Условие задания  ", pages: 100 },
      ]) {
        const activity = await addActivity(first, input);
        assert.match(activity.id, /^a-[a-f0-9]{8}$/);
        assert.equal(activity.type, input.type);
        assert.ok(!("completed" in activity));
        activities.push(activity);
      }
      assert.equal(activities[0].src, "/media/demo.mp4");
      assert.ok(!("maxGrade" in activities[0]) && !("due" in activities[0]) && !("pages" in activities[0]));
      assert.ok(!("description" in activities[1]));
      assert.equal(activities[4].maxGrade, 100);
      assert.equal(activities[4].description, "Условие задания");
      assert.ok(!("pages" in activities[4]));
      assert.equal(Date.parse(activities[4].due), Date.parse(due));
      assert.deepEqual((await detail()).sections[0].activities, activities);
    });

    await t.test("права проверяются для всех операций, чужой курс скрыт", async () => {
      for (const [method, path, body] of [
        ["POST", `${root}/sections`, { title: "Попытка" }],
        ["PATCH", `${root}/sections/${first.id}`, { title: "Попытка" }],
        ["DELETE", `${root}/sections/${first.id}`],
        ["PUT", `${root}/sections/order`, { sectionIds: [first.id, second.id] }],
        ["POST", `${root}/sections/${first.id}/activities`, { type: "quiz", title: "Попытка" }],
        [
          "PUT",
          `${root}/sections/${first.id}/activities/order`,
          { activityIds: activities.map((item) => item.id) },
        ],
        ["PATCH", `${root}/activities/${activities[0].id}`, { title: "Попытка" }],
        ["DELETE", `${root}/activities/${activities[0].id}`],
      ]) {
        assert.equal((await send(method, path, body, student)).status, 403, `${method} student`);
        assert.equal((await send(method, path, body, foreign)).status, 404, `${method} foreign`);
        if (name === "C#")
          assert.equal((await send(method, path, body, tutor, false)).status, 403, `${method} header`);
      }
      assert.equal((await get(baseUrl, root, foreign.cookie)).status, 404);
      assert.equal((await send("POST", "/api/courses/missing/sections", { title: "Попытка" })).status, 404);
      assert.equal(
        (await send("POST", `${root}/sections`, { title: "Попытка" }, { cookie: "helios-auth=forged" }))
          .status,
        401,
      );
    });

    await t.test("валидация полей и неизменность типа", async () => {
      for (const [input, field, message] of [
        [{ type: "video", title: "Видео" }, "src", "Укажите ссылку на видеофайл"],
        [{ type: "pdf", title: "Документ" }, "pages", "Укажите число страниц"],
        [{ type: "presentation", title: "Слайды", pages: " " }, "pages", "Укажите число страниц"],
        [
          { type: "assignment", title: "Задание", maxGrade: 0 },
          "maxGrade",
          "Максимальная оценка — от 1 до 1000",
        ],
        [{ type: "unknown", title: "Материал" }, "type", "Выберите тип материала"],
        [{ type: "quiz", title: " " }, "title", "Название — от 2 до 120 символов"],
        [{ type: "quiz", title: "Тест", due: "no-date" }, "due", "Укажите дату и время сдачи"],
        [
          { type: "video", title: "Видео", src: "http://example.ru/file" },
          "src",
          "Ссылка на файл: https://… или путь /media/…, до 500 символов",
        ],
        [{ type: "pdf", title: "Документ", pages: 501 }, "pages", "Страниц — от 1 до 500"],
        [{ type: "pdf", title: "Документ", pages: 1.5 }, "pages", "Страниц — от 1 до 500"],
        [{ type: "pdf", title: "Документ", pages: "12" }, "pages", "Страниц — от 1 до 500"],
        [
          { type: "quiz", title: "Тест", durationMin: 601 },
          "durationMin",
          "Длительность — от 1 до 600 минут",
        ],
        [
          { type: "assignment", title: "Задание", description: "я".repeat(4001) },
          "description",
          "Условие — до 4000 символов",
        ],
      ])
        await expect(
          await send("POST", `${root}/sections/${first.id}/activities`, input),
          400,
          field,
          message,
        );
      await expect(
        await patch(activities[0], { type: "quiz" }),
        400,
        "type",
        "Тип материала изменить нельзя",
      );
      await expect(await patch(activities[0], { type: "video", maxGrade: 123, description: "лишнее" }), 200);
      assert.deepEqual((await detail()).sections[0].activities, activities);
    });

    await t.test("порядок модулей и материалов целиком, дубликаты запрещены", async () => {
      const sectionIds = [second.id, first.id];
      const ordered = await expect(await send("PUT", `${root}/sections/order`, { sectionIds }), 200);
      assert.deepEqual(
        ordered.map((section) => [section.id, section.order]),
        [
          [second.id, 1],
          [first.id, 2],
        ],
      );
      for (const ids of [[first.id], [first.id, first.id], [first.id, "missing"], null])
        await expect(
          await send("PUT", `${root}/sections/order`, { sectionIds: ids }),
          400,
          "sectionIds",
          "Неверный порядок модулей",
        );
      const activityIds = activities.map((item) => item.id).reverse();
      const list = await expect(
        await send("PUT", `${root}/sections/${first.id}/activities/order`, { activityIds }),
        200,
      );
      assert.deepEqual(
        list.map((item) => item.id),
        activityIds,
      );
      for (const ids of [
        activityIds.slice(1),
        activityIds.map(() => activityIds[0]),
        [...activityIds.slice(1), "missing"],
        "bad",
      ])
        await expect(
          await send("PUT", `${root}/sections/${first.id}/activities/order`, { activityIds: ids }),
          400,
          "activityIds",
          "Неверный порядок материалов",
        );
      const after = await detail();
      assert.deepEqual(
        after.sections.map((section) => section.id),
        sectionIds,
      );
      assert.deepEqual(
        after.sections[1].activities.map((item) => item.id),
        activityIds,
      );
      // Эталонный мок относит неизвестный модуль здесь к ошибке порядка, а не к 404.
      await expect(
        await send("PUT", `${root}/sections/missing/activities/order`, { activityIds: [] }),
        400,
        "activityIds",
        "Неверный порядок материалов",
      );
    });

    await t.test("перенос сохраняет все поля, добавляет в конец и не меняет другие материалы", async () => {
      const anchor = await addActivity(second, { type: "quiz", title: "Уже в модуле" });
      const assignment = activities[4];
      await expect(
        await patch(assignment, { sectionId: "missing", title: "Не сохранить" }),
        400,
        "sectionId",
        "Такого модуля нет",
      );
      assert.deepEqual((await detail()).sections[1].activities[0], assignment);
      assert.deepEqual(await expect(await patch(assignment, { sectionId: second.id }), 200), assignment);
      let after = await detail();
      assert.deepEqual(after.sections[0].activities, [anchor, assignment]);
      assert.deepEqual(
        after.sections[1].activities.map((item) => item.id),
        activities
          .slice(0, 4)
          .map((item) => item.id)
          .reverse(),
      );
      const movedVideo = await expect(
        await patch(activities[0], { sectionId: second.id, title: "Новое видео" }),
        200,
      );
      assert.equal(movedVideo.src, activities[0].src);
      assert.equal(movedVideo.durationMin, activities[0].durationMin);
      after = await detail();
      assert.deepEqual(after.sections[0].activities, [anchor, assignment, movedVideo]);
      assert.equal(after.sections[1].activities.length, 3);
      // Повторный перенос и патч в том же модуле не меняют порядок.
      await expect(await patch(assignment, { sectionId: first.id }), 200);
      await expect(
        await patch(assignment, { sectionId: first.id, description: "Обновлённое условие", maxGrade: 75 }),
        200,
      );
      after = await detail();
      assert.equal(after.sections[1].activities.at(-1).id, assignment.id);
      assert.equal(after.sections[1].activities.at(-1).maxGrade, 75);
    });

    await t.test("срок с поясом, null и пустая строка очищают необязательные поля", async () => {
      const assignment = activities[4];
      const dated = await expect(await patch(assignment, { due }), 200);
      assert.equal(Date.parse(dated.due), Date.parse(due));
      assert.match(dated.due, /Z$|[+-]\d{2}:\d{2}$/);
      const cleared = await expect(
        await patch(assignment, { due: null, description: "  ", maxGrade: null }),
        200,
      );
      for (const field of ["due", "description", "maxGrade"]) assert.ok(!(field in cleared));
      await expect(await patch(assignment, { due }), 200);
      const empty = await expect(await patch(assignment, { due: " " }), 200);
      assert.ok(!("due" in empty));
      const defaulted = await addActivity(second, { type: "assignment", title: "Без оценки", maxGrade: " " });
      assert.equal(defaulted.maxGrade, 100);
      const quiz = await expect(await patch(activities[3], { durationMin: " ", due: null }), 200);
      assert.ok(!("durationMin" in quiz) && !("due" in quiz));
    });

    await t.test("удаление, перенумерация модулей и отсутствующие объекты", async () => {
      await expect(await send("DELETE", `${root}/sections/${first.id}`), 409);
      assert.equal((await send("PATCH", `${root}/activities/missing`, { title: "Материал" })).status, 404);
      assert.equal((await send("DELETE", `${root}/activities/missing`)).status, 404);
      assert.equal((await send("PATCH", `${root}/sections/missing`, { title: "Модуль" })).status, 404);
      assert.equal((await send("DELETE", `${root}/sections/missing`)).status, 404);
      assert.equal(
        (await send("POST", `${root}/sections/missing/activities`, { type: "quiz", title: "Материал" }))
          .status,
        404,
      );
      for (const section of (await detail()).sections)
        for (const activity of section.activities)
          await expect(await send("DELETE", `${root}/activities/${activity.id}`), 204);
      await expect(await send("DELETE", `${root}/sections/${second.id}`), 204);
      assert.equal((await detail()).sections[0].order, 1);
      await expect(await send("DELETE", `${root}/sections/${first.id}`), 204);
      assert.deepEqual((await detail()).sections, []);
    });
  });
}
