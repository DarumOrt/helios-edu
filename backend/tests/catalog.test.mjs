import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { apiUrl, get, login } from "./client.mjs";

// Поиск курсов: опубликованные курсы для всех ролей, без материалов; accessible — по правам VisibleCourses.
for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: поиск курсов — карточки для всех ролей, материалы только своим`, async () => {
    assert.equal((await get(baseUrl, "/api/catalog")).status, 401);

    const student = await login(baseUrl);
    const response = await get(baseUrl, "/api/catalog", student.cookie);
    assert.equal(response.status, 200);
    const catalog = await response.json();
    const course = catalog.find((c) => c.id === "c-dor-ai");
    assert.ok(course, "курс М1227 есть в поиске");
    assert.equal(course.faculty, "ИНЭК");
    assert.equal(course.academicYear, "2026/2027");
    assert.equal(course.tutor.name, "Казаринова Н.Л.");
    const group = course.cohorts.find((g) => g.name === "М1227");
    assert.deepEqual(
      [group.year, group.level, group.directionCode, group.profile],
      [2, "master", "44.04.01", "Искусственный интеллект в образовании"],
    );
    assert.ok(course.sections.length > 0 && course.sections.every((s) => typeof s.activities === "number"));
    assert.ok(!JSON.stringify(catalog).includes("/media/"), "ссылки на материалы не отдаются");
    assert.ok(
      catalog.every((c) => c.accessible),
      "студенту М1227 открыты все курсы группы",
    );

    // студент другой группы видит карточки, но не материалы
    const outsider = await login(baseUrl, "student4@student.pspu.ru");
    const foreign = await (await get(baseUrl, "/api/catalog", outsider.cookie)).json();
    assert.equal(foreign.length, catalog.length);
    assert.ok(foreign.every((c) => !c.accessible));

    // преподавателю открыты только свои курсы
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const own = await (await get(baseUrl, "/api/catalog", tutor.cookie)).json();
    assert.deepEqual(
      own.filter((c) => c.accessible).map((c) => c.id),
      ["c-dor-ai"],
    );
  });

  test(`${name}: межфакультетские разделы не дают доступ к материалам`, async () => {
    const admin = await login(baseUrl, "admin@pspu.ru");
    const organizer = await login(baseUrl, "organizer@pspu.ru");
    const outsider = await login(baseUrl, "student4@student.pspu.ru");
    const suffix = randomBytes(4).toString("hex");
    const path = "/api/catalog-collections";
    const name = `Общие дисциплины ${suffix}`;
    const codes = [`Проверка-А ${suffix}`, `Проверка-Б ${suffix}`];
    const send = (actor, method, endpoint, body) =>
      fetch(baseUrl + endpoint, {
        method,
        headers: {
          Cookie: actor.cookie,
          Origin: new URL(baseUrl).origin,
          "Content-Type": "application/json",
          "X-Helios-Client": "web",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const list = async (actor, endpoint = path) => {
      const response = await get(baseUrl, endpoint, actor.cookie);
      assert.equal(response.status, 200);
      return await response.json();
    };
    const payload = { name, facultyCodes: codes, courseIds: ["c-dor-ai"] };
    let id;
    const createdFaculties = [];
    try {
      assert.equal((await send(organizer, "POST", path, payload)).status, 403);
      assert.equal((await get(baseUrl, path + "/manage", organizer.cookie)).status, 403);
      for (const code of codes) {
        assert.equal((await send(admin, "POST", "/api/faculties", { code, name: code })).status, 201);
        createdFaculties.push(code);
      }
      assert.equal(
        (await send(admin, "POST", path, { ...payload, facultyCodes: codes.slice(0, 1) })).status,
        400,
      );
      const response = await send(admin, "POST", path, payload);
      assert.equal(response.status, 201);
      ({ id } = await response.json());
      assert.ok((await list(admin, path + "/manage")).some((item) => item.id === id));
      const item = (await list(outsider)).find((item) => item.id === id);
      assert.equal(item.name, name);
      assert.deepEqual(item.courseIds, ["c-dor-ai"]);
      const course = (await list(outsider, "/api/catalog")).find((course) => course.id === "c-dor-ai");
      assert.equal(course.accessible, false);
      assert.equal(course.faculty, "ИНЭК");
      assert.equal((await get(baseUrl, "/api/courses/c-dor-ai", outsider.cookie)).status, 404);
      assert.equal(
        (await send(admin, "DELETE", "/api/faculties/" + encodeURIComponent(codes[0]))).status,
        409,
      );
      const updated = await send(admin, "PUT", path + "/" + id, { ...payload, courseIds: [] });
      assert.equal(updated.status, 200);
      assert.deepEqual((await updated.json()).courseIds, []);
      assert.ok(!(await list(outsider)).some((item) => item.id === id));
    } finally {
      if (id) assert.equal((await send(admin, "DELETE", path + "/" + id)).status, 204);
      for (const code of createdFaculties)
        assert.equal((await send(admin, "DELETE", "/api/faculties/" + encodeURIComponent(code))).status, 204);
    }
  });
}
