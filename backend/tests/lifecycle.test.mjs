import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { apiUrl, login } from "./client.mjs";

const exec = promisify(execFile);
const { cookie } = await login(apiUrl);
const compose = (...args) =>
  exec("docker", ["compose", "--profile", "backend", ...args], { timeout: 30_000 });
const sql = (query) =>
  compose(
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "helios",
    "-d",
    "helios_edu",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    query,
  );
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const getCourse = async () => {
  const response = await fetch(`${apiUrl}/api/courses/c-matan`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  return response.json();
};

async function waitUntilReady() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`${apiUrl}/api/health/ready`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {
      // Соединение недоступно, пока контейнер запускается.
    }
    await setTimeout(250);
  }
  throw new Error("API не стал готов после перезапуска");
}

// Запускать только на отдельной демобазе: проверка временно меняет название курса.
test("PostgreSQL сохраняет изменения; перезапуск не перезаписывает их моками", async () => {
  const original = await getCourse();
  const changedTitle = `${original.title} [проверка хранения]`;
  try {
    await sql(`UPDATE "Courses" SET "Title" = ${literal(changedTitle)} WHERE "Id" = 'c-matan'`);
    assert.equal((await getCourse()).title, changedTitle);
    await compose("restart", "api");
    await waitUntilReady();
    assert.equal((await getCourse()).title, changedTitle);

    if (process.env.TEST_WEB_URL) {
      const response = await fetch(`${process.env.TEST_WEB_URL}/api/courses/c-matan`, {
        headers: { Cookie: cookie },
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).title, changedTitle);

      await compose("stop", "api");
      const unavailable = await fetch(`${process.env.TEST_WEB_URL}/api/courses`);
      assert.equal(unavailable.status, 503);
      assert.deepEqual(await unavailable.json(), { error: "Сервис обучения временно недоступен" });
    }
  } finally {
    await compose("start", "api");
    await waitUntilReady();
    await sql(`UPDATE "Courses" SET "Title" = ${literal(original.title)} WHERE "Id" = 'c-matan'`);
  }
  assert.deepEqual(await getCourse(), original);
});

test("Курс вне группы скрыт даже при наличии старого Enrollment", async () => {
  const courseId = "c-psych-110";
  try {
    await sql(`DELETE FROM "CohortCourses" WHERE "CohortId" = 'co-1' AND "CourseId" = '${courseId}'`);
    for (const baseUrl of [apiUrl, ...(process.env.TEST_WEB_URL ? [process.env.TEST_WEB_URL] : [])]) {
      const headers = { Cookie: cookie };
      const response = await fetch(`${baseUrl}/api/courses/${courseId}`, { headers });
      assert.equal(response.status, 404);
      const list = await fetch(`${baseUrl}/api/courses`, { headers });
      assert.equal(list.status, 200);
      assert.ok(!(await list.json()).some((course) => course.id === courseId));
    }
  } finally {
    await sql(
      `INSERT INTO "CohortCourses" ("CohortId", "CourseId", "Position") VALUES ('co-1', '${courseId}', 3) ON CONFLICT DO NOTHING`,
    );
  }
});

test("Преподаватель не открывает курс без своего назначения", async () => {
  const session = await login(apiUrl, "kazarinova@pspu.ru");
  try {
    await sql(`UPDATE "Courses" SET "TutorId" = 'unassigned' WHERE "Id" = 'c-psych-110'`);
    const response = await fetch(`${apiUrl}/api/courses/c-psych-110`, {
      headers: { Cookie: session.cookie },
    });
    assert.equal(response.status, 404);
  } finally {
    await sql(`UPDATE "Courses" SET "TutorId" = 'u-tutor-1' WHERE "Id" = 'c-psych-110'`);
  }
});

test("Изменение роли в базе действует на уже выданную сессию", async () => {
  const session = await login(apiUrl, "admin@pspu.ru");
  try {
    await sql(`UPDATE "Accounts" SET "Role" = 'student' WHERE "Id" = 'u-admin'`);
    const response = await fetch(`${apiUrl}/api/users`, { headers: { Cookie: session.cookie } });
    assert.equal(response.status, 403);
  } finally {
    await sql(`UPDATE "Accounts" SET "Role" = 'admin' WHERE "Id" = 'u-admin'`);
  }
});

test("Истёкшая сессия больше не открывает курсы", async () => {
  const session = await login(apiUrl);
  const token = session.cookie.slice("helios-auth=".length);
  const tokenHash = createHash("sha256").update(token).digest("hex").toUpperCase();
  await sql(
    `UPDATE "LoginSessions" SET "ExpiresAt" = '2000-01-01T00:00:00Z' WHERE "TokenHash" = '${tokenHash}'`,
  );
  const response = await fetch(`${apiUrl}/api/courses`, { headers: { Cookie: session.cookie } });
  assert.equal(response.status, 401);
});
