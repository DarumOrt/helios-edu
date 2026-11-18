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
        consent: true,
      });
      assert.equal(register.status, 403);
      assert.equal(
        (await register.json()).error,
        "Приём заявок закрыт. Учётную запись создаёт администратор.",
      );
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
  test(name + ": оформление доступно на входе, изменяет только администратор", async () => {
    const admin = await login(baseUrl, "admin@pspu.ru");
    const organizer = await login(baseUrl, "organizer@pspu.ru");
    const path = "/api/branding";
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMioAAAAASUVORK5CYII=";
    const put = (actor, body) =>
      fetch(baseUrl + path, {
        method: "PUT",
        headers: {
          Cookie: actor.cookie,
          Origin: new URL(baseUrl).origin,
          "Content-Type": "application/json",
          "X-Helios-Client": "web",
        },
        body: JSON.stringify(body),
      });
    const reset = { subtitle: null, loginText: null, footerText: null, logo: null };
    try {
      assert.equal((await put(organizer, { subtitle: "Учебный центр" })).status, 403);
      assert.equal((await put(admin, { logo: Buffer.from("<svg/>").toString("base64") })).status, 400);
      assert.equal((await put(admin, { subtitle: "а".repeat(33) })).status, 400);
      const saved = await put(admin, {
        subtitle: "Учебный центр",
        loginText: "Добро пожаловать в учебный центр",
        logo: png,
      });
      assert.equal(saved.status, 200, await saved.clone().text());
      const brand = await saved.json();
      assert.ok(brand.logoVersion);
      assert.deepEqual(await (await get(baseUrl, path)).json(), brand);
      const asset = await get(baseUrl, path + "/logo");
      assert.equal(asset.status, 200);
      assert.equal(asset.headers.get("content-type"), "image/png");
      assert.equal(asset.headers.get("x-content-type-options"), "nosniff");
      assert.equal(Buffer.from(await asset.arrayBuffer()).toString("base64"), png);
      const changed = await put(admin, { footerText: "Справочная служба" });
      assert.equal((await changed.json()).logoVersion, brand.logoVersion);
      const log = await (await get(baseUrl, "/api/audit", admin.cookie)).json();
      assert.ok(log.items.some((item) => item.target === "Оформление организации"));
      if (name === "Next.js") assert.match(await (await get(baseUrl, "/login")).text(), /Учебный центр/);
    } finally {
      assert.deepEqual(await (await put(admin, reset)).json(), {});
      assert.equal((await get(baseUrl, path + "/logo")).status, 404);
    }
  });
}
