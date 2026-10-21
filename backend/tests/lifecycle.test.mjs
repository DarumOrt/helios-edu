import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { test } from "node:test";

const exec = promisify(execFile);
const apiUrl = process.env.TEST_API_URL ?? "http://127.0.0.1:8080";
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
  const response = await fetch(`${apiUrl}/api/courses/c-matan`);
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
      const response = await fetch(`${process.env.TEST_WEB_URL}/api/courses/c-matan`);
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
