import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { apiUrl, login, get as authenticatedGet } from "./client.mjs";

const courses = JSON.parse(
  await readFile(new URL("../HeliosEdu.Api/Data/courses.json", import.meta.url), "utf8"),
);
const { cookie } = await login(apiUrl);

// Участники, прогресс и «пройдено» считаются для того, кто смотрит (Courses/CourseProgress.cs),
// поэтому с исходными данными сравниваем без них; сами числа проверяет отдельный тест ниже.
const withoutStats = ({ enrolled: _enrolled, progress: _progress, sections, ...course }) => ({
  ...course,
  ...(sections && {
    sections: sections.map((section) => ({
      ...section,
      activities: section.activities.map(({ completed: _completed, ...activity }) => activity),
    })),
  }),
});

async function get(baseUrl, path) {
  return authenticatedGet(baseUrl, path, cookie);
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
    const expected = courses.map(({ sections: _sections, ...summary }) => withoutStats(summary));
    assert.deepEqual((await response.json()).map(withoutStats), expected);
  });

  test(`${name}: разделы и материалы каждого курса совпадают с исходными моками`, async () => {
    for (const course of courses) {
      const response = await get(baseUrl, `/api/courses/${course.id}`);
      assert.equal(response.status, 200);
      assert.deepEqual(withoutStats(await response.json()), withoutStats(course));
    }
  });

  test(`${name}: неизвестный курс возвращает прежний формат 404`, async () => {
    const response = await get(baseUrl, "/api/courses/course-that-does-not-exist");
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not found" });
  });
}

if (process.env.TEST_WEB_URL)
  test("Next.js: дашборд получает доступные курсы вместе с разделами", async () => {
    const response = await get(process.env.TEST_WEB_URL, "/api/courses?sections=1");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map(withoutStats), courses.map(withoutStats));
  });

for (const [name, baseUrl] of [
  ["C# API", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js → C# API", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: участники, прогресс и «пройдено» — для каждого ученика свои`, async () => {
    const student = await login(baseUrl, "student12@student.pspu.ru");
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const course = async (who) =>
      (await authenticatedGet(baseUrl, "/api/courses/c-dor-ai", who.cookie)).json();
    const video = (detail) => detail.sections[0].activities.find((a) => a.id === "mv1");

    const before = await course(student);
    assert.equal(before.enrolled, 16, "все студенты М1227");
    assert.equal(typeof before.progress, "number");
    // ученик досмотрел видеолекцию — материал пройден у него, но не у других
    const event = await fetch(`${baseUrl}/api/me/courses/c-dor-ai/events`, {
      method: "POST",
      headers: {
        Cookie: student.cookie,
        "Content-Type": "application/json",
        "X-Helios-Client": "web",
        ...(process.env.TEST_WEB_URL && { Origin: new URL(process.env.TEST_WEB_URL).origin }),
      },
      body: JSON.stringify({ type: "activity.completed", activityId: "mv1", coverage: 95 }),
    });
    assert.equal(event.status, 204);
    const after = await course(student);
    assert.equal(video(after).completed, true);
    assert.ok(after.progress >= before.progress, "прогресс не падает после пройденного материала");
    const other = await course(await login(baseUrl, "student13@student.pspu.ru"));
    assert.ok(video(other).completed !== true, "чужое «пройдено» не видно");

    // преподавателю — средний прогресс группы, без «пройдено» у материалов
    const teacher = await course(tutor);
    assert.equal(typeof teacher.progress, "number");
    assert.ok(teacher.sections.flatMap((s) => s.activities).every((a) => !("completed" in a)));
    // срок сдачи — прежний формат строки, теперь из столбца даты
    assert.match(
      teacher.sections[0].activities.find((a) => a.id === "mq1").due,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
}
