import assert from "node:assert/strict";
import { test } from "node:test";
import { apiUrl, get, login } from "./client.mjs";

// Настройки системы в PostgreSQL (Audit/AuditEndpoints.cs): читают все, меняет администратор,
// выключатели регистрации и объявлений проверяет сам C#. Напрямую и через Next.
for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: настройки — права, проверка полей, регистрация и объявления`, async () => {
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
        body: JSON.stringify(body),
      });
    const admin = await login(baseUrl, "admin@pspu.ru");
    const organizer = await login(baseUrl, "organizer@pspu.ru");
    const tutor = await login(baseUrl, "tutor@pspu.ru");

    // читать может любой, даже без входа: страница регистрации решает, показывать ли форму
    const anonymous = await get(baseUrl, "/api/settings");
    assert.equal(anonymous.status, 200);
    const before = await anonymous.json();
    assert.deepEqual(Object.keys(before).sort(), ["allowRegistration", "announcementsEnabled"]);

    // менять — только администратор; неизвестные поля и не да/нет — 400 (отчёт 4.14)
    assert.equal(
      (await send(organizer.cookie, "PUT", "/api/settings", { allowRegistration: false })).status,
      403,
    );
    const bad = await send(admin.cookie, "PUT", "/api/settings", { allowRegistration: "нет", theme: "dark" });
    assert.equal(bad.status, 400);
    assert.deepEqual((await bad.json()).fields, {
      allowRegistration: "Ожидается да или нет",
      theme: "Неизвестная настройка",
    });

    try {
      const closed = await send(admin.cookie, "PUT", "/api/settings", {
        allowRegistration: false,
        announcementsEnabled: false,
      });
      assert.deepEqual(await closed.json(), { allowRegistration: false, announcementsEnabled: false });

      // регистрацию и объявления запрещает сам сервер
      const register = await send("", "POST", "/api/auth/register", {
        name: "Закрытая Регистрация",
        email: `closed-${Date.now()}@example.ru`,
        password: "Password2026",
        consent: true,
      });
      assert.equal(register.status, 403);
      assert.equal((await register.json()).error, "Регистрация закрыта. Учётную запись создаст организатор.");
      const announcement = await send(tutor.cookie, "POST", "/api/courses/c-dor-ai/announcements", {
        title: "Не уйдёт",
        body: "Объявления выключены",
      });
      assert.equal(announcement.status, 403);
      assert.equal((await announcement.json()).error, "Объявления отключены администратором");
    } finally {
      const restored = await send(admin.cookie, "PUT", "/api/settings", before);
      assert.deepEqual(await restored.json(), before);
    }
  });
}
