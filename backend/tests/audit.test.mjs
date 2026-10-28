import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { promisify } from "node:util";
import { apiUrl, demoPassword, get, login } from "./client.mjs";

// Журнал действий в PostgreSQL (Audit/AuditLog.cs, AuditEndpoints.cs): названия вместо id и «было → стало»
// (отчёт 4.3), входы и неудачные входы, фильтры, страницы и запрет правки записей.

const exec = promisify(execFile);
const sql = async (query) =>
  (
    await exec(
      "docker",
      [
        "compose",
        "--profile",
        "backend",
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "helios",
        "-d",
        "helios_edu",
        "-At",
        "-c",
        query,
      ],
      { timeout: 30_000 },
    )
  ).stdout.trim();

for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: журнал — кто, что, над чем и что изменилось; фильтры и страницы`, async () => {
    const origin = new URL(baseUrl).origin;
    const send = (cookie, method, path, body) =>
      fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-Helios-Client": "web",
          Origin: origin,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const admin = await login(baseUrl, "admin@pspu.ru");
    const organizer = await login(baseUrl, "organizer@pspu.ru");
    const audit = async (query = "") => {
      const response = await get(baseUrl, `/api/audit${query}`, admin.cookie);
      assert.equal(response.status, 200);
      return response.json();
    };

    // журнал видит только администратор
    assert.equal((await get(baseUrl, "/api/audit", organizer.cookie)).status, 403);

    // неудачный вход — с введённой почтой, без пароля
    const wrong = await send("", "POST", "/api/auth/login", {
      email: "organizer@pspu.ru",
      password: "не тот пароль",
    });
    assert.equal(wrong.status, 401);
    const failed = (await audit("?category=auth&q=organizer%40pspu.ru")).items.find(
      (e) => e.action === "auth.login_failed",
    );
    assert.ok(failed, "неудачный вход в журнале");
    assert.equal(failed.actionText, "Неудачный вход");
    assert.ok(!JSON.stringify(failed).includes("не тот пароль"));

    // изменение пользователя — название вместо id и что изменилось
    const faculty = `Ф-${Date.now() % 100000}`;
    const before = (await (await get(baseUrl, "/api/users", admin.cookie)).json()).find(
      (u) => u.id === "u-stud-2",
    );
    assert.equal((await send(organizer.cookie, "PATCH", "/api/users/u-stud-2", { faculty })).status, 200);
    try {
      const page = await audit("?category=users&role=organizer");
      assert.ok(page.items.every((e) => e.category === "users" && e.actorRole === "organizer"));
      const entry = page.items.find((e) => e.action === "user.updated" && e.targetId === "u-stud-2");
      assert.ok(entry, "изменение пользователя в журнале");
      assert.equal(entry.actorName, "Анна Лебедева");
      assert.match(entry.target, /^Иван Вагулин · /);
      assert.deepEqual(entry.changes, [{ field: "Факультет", before: before.faculty, after: faculty }]);

      // поиск по названию и даты
      const today = new Date().toISOString().slice(0, 10);
      assert.ok(
        (await audit(`?q=${encodeURIComponent(faculty)}&from=${today}&to=${today}`)).items.length === 0,
        "поиск — по тому, кто и над чем, а не по значениям",
      );
      assert.ok(
        (await audit(`?q=${encodeURIComponent("Вагулин")}&from=${today}`)).items.some(
          (e) => e.id === entry.id,
        ),
      );
      assert.equal((await audit("?to=2000-01-01")).items.length, 0);
    } finally {
      await send(organizer.cookie, "PATCH", "/api/users/u-stud-2", { faculty: before.faculty ?? null });
    }

    // страницы: курсор ведёт к более старым записям без повторов
    const first = await audit("?limit=2");
    assert.equal(first.items.length, 2);
    assert.ok(first.nextCursor);
    const second = await audit(`?limit=2&cursor=${first.nextCursor}`);
    assert.ok(second.items.every((e) => e.id < first.items[1].id));
  });
}

test("C#: записи журнала нельзя изменить или удалить даже в базе", async () => {
  await login(apiUrl, "admin@pspu.ru", demoPassword);
  const id = await sql(`SELECT max("Id") FROM "AuditLog"`);
  await assert.rejects(
    sql(`UPDATE "AuditLog" SET "ActorName" = 'подмена' WHERE "Id" = ${id}`),
    /append-only/,
  );
  await assert.rejects(sql(`DELETE FROM "AuditLog" WHERE "Id" = ${id}`), /append-only/);
});
