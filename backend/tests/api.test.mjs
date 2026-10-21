import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const courses = JSON.parse(
  await readFile(new URL("../HeliosEdu.Api/Data/courses.json", import.meta.url), "utf8"),
);
const apiUrl = process.env.TEST_API_URL ?? "http://127.0.0.1:8080";

async function get(baseUrl, path) {
  return fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(10_000) });
}

test("API: процесс и база данных готовы к работе", async () => {
  for (const path of ["/api/health", "/api/health/ready"]) {
    const response = await get(apiUrl, path);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  }
});

for (const [name, baseUrl] of [
  ["C# API", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js → C# API", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: список сохраняет контракт и порядок демонстрационных курсов`, async () => {
    const response = await get(baseUrl, "/api/courses");
    assert.equal(response.status, 200);
    const expected = courses.map(({ sections: _sections, ...summary }) => summary);
    assert.deepEqual(await response.json(), expected);
  });

  test(`${name}: разделы и материалы каждого курса совпадают с исходными моками`, async () => {
    for (const course of courses) {
      const response = await get(baseUrl, `/api/courses/${course.id}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), course);
    }
  });

  test(`${name}: неизвестный курс возвращает прежний формат 404`, async () => {
    const response = await get(baseUrl, "/api/courses/course-that-does-not-exist");
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not found" });
  });
}
