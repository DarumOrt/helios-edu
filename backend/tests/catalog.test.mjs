import assert from "node:assert/strict";
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
}
