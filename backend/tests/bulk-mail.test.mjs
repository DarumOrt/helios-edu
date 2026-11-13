import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { apiUrl, get, login } from "./client.mjs";

// Настоящий SMTP-диалог без внешней почты. Запускать с compose.testing.yaml.
function smtpFixture() {
  const messages = [];
  const sockets = new Set();
  let mode = "ok";
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.write("220 helios-test ESMTP\r\n");
    let buffer = "";
    let data = false;
    let body = "";
    let recipient = "";
    socket.on("data", (bytes) => {
      buffer += bytes.toString();
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n");
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line === ".") {
            data = false;
            messages.push({ recipient, body, at: Date.now() });
            body = "";
            socket.write("250 queued\r\n");
          } else body += line + "\r\n";
        } else if (/^EHLO|^HELO/.test(line))
          socket.write("250-helios-test\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n");
        else if (/^AUTH/.test(line)) socket.write("235 authenticated\r\n");
        else if (/^MAIL/.test(line)) socket.write("250 ok\r\n");
        else if (/^RCPT/.test(line)) {
          recipient = line.match(/<(.+)>/)?.[1];
          socket.write(
            mode === "temporary"
              ? "450 try later\r\n"
              : mode === "permanent"
                ? "550 rejected\r\n"
                : "250 ok\r\n",
          );
        } else if (line === "DATA") {
          data = true;
          socket.write("354 continue\r\n");
        } else if (line === "QUIT") socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      }
    });
  });
  return {
    messages,
    server,
    setMode: (value) => {
      mode = value;
    },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

test("общие курсы, CSV, активация и SMTP с очередью", { timeout: 160000 }, async (t) => {
  const admin = await login(apiUrl, "admin@pspu.ru");
  const organizer = await login(apiUrl, "organizer@pspu.ru");
  const student = await login(apiUrl);
  const tutor = await login(apiUrl, "tutor@pspu.ru");
  const unique = randomBytes(5).toString("hex");
  const send = (method, path, body, actor = admin, base = apiUrl, client = true) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        Cookie: actor.cookie,
        "Content-Type": "application/json",
        Origin: client ? new URL(base).origin : "https://other.example",
        ...(client ? { "X-Helios-Client": "web" } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(125000),
    });
  const expect = async (response, status = 200) => {
    const text = await response.text();
    assert.equal(response.status, status, text);
    return text ? JSON.parse(text) : undefined;
  };
  const fixture = smtpFixture();
  await new Promise((resolve) => fixture.server.listen(2525, "0.0.0.0", resolve));
  const groups = [];
  const createdUsers = [];
  let course;
  const previousSmtp = await expect(await get(apiUrl, "/api/mail/settings", admin.cookie));
  const settings = {
    host: "host.docker.internal",
    port: 2525,
    security: "none",
    username: "test",
    password: "mock-secret-only",
    fromEmail: "helios@example.org",
    fromName: "HeliosEDU",
    userCreated: false,
    invitation: false,
    courseAssigned: false,
    groupAdded: false,
    coursePublished: false,
  };
  try {
    await t.test("импорт, SMTP и рассылки закрыты другим ролям и чужому сайту", async () => {
      for (const actor of [organizer, student, tutor]) {
        for (const path of [
          "/api/users/import",
          "/api/users/import/preview",
          "/api/mail/campaigns",
          "/api/mail/check",
        ])
          assert.equal((await send("POST", path, {}, actor)).status, 403, path);
        assert.equal((await get(apiUrl, "/api/mail/settings", actor.cookie)).status, 403);
      }
      assert.equal((await send("POST", "/api/mail/campaigns", {}, admin, apiUrl, false)).status, 403);
    });
    await t.test("один курс для трёх групп: содержание общее, прежние назначения сохранены", async () => {
      const before = await expect(await get(apiUrl, "/api/cohorts/co-1", admin.cookie));
      for (let i = 0; i < 3; i++) {
        const group = await expect(await send("POST", "/api/cohorts", { name: `Т${unique}${i}` }), 201);
        groups.push(group);
        const result = await expect(
          await send("POST", "/api/users", {
            name: `Тест Студент ${i}`,
            email: `${unique}-${i}@example.org`,
            role: "student",
            group: group.name,
          }),
          201,
        );
        createdUsers.push(result);
      }
      const code = [...randomBytes(6)].map((b) => String.fromCharCode(65 + (b % 26))).join("") + "-789";
      course = await expect(
        await send("POST", "/api/courses", {
          code,
          title: "Общий тестовый курс",
          category: "Тест",
          description: "",
          tutorId: tutor.user.id,
          cohortIds: [...groups.map((g) => g.id), groups[0].id],
        }),
        201,
      );
      await expect(await send("PATCH", `/api/courses/${course.id}`, { status: "published" }));
      await expect(await send("PATCH", `/api/courses/${course.id}`, { title: "Изменено для трёх групп" }));
      for (const result of createdUsers) {
        const actor = await login(apiUrl, result.user.email, result.temporaryPassword);
        const visible = await expect(await get(apiUrl, `/api/courses/${course.id}`, actor.cookie));
        assert.equal(visible.title, "Изменено для трёх групп");
      }
      const after = await expect(await get(apiUrl, "/api/cohorts/co-1", admin.cookie));
      assert.deepEqual(after.courseIds, before.courseIds);
      assert.equal((await send("PATCH", `/api/courses/${course.id}`, { cohortIds: [] }, tutor)).status, 403);
      await expect(
        await send("PATCH", `/api/courses/${course.id}`, { cohortIds: groups.slice(0, 2).map((g) => g.id) }),
      );
      const third = await login(apiUrl, createdUsers[2].user.email, createdUsers[2].temporaryPassword);
      assert.equal((await get(apiUrl, `/api/courses/${course.id}`, third.cookie)).status, 404);
      await expect(await send("PATCH", `/api/courses/${course.id}`, { cohortIds: [] }));
      const simultaneous = await Promise.all(
        groups.slice(0, 2).map((g) => send("PATCH", `/api/courses/${course.id}`, { cohortIds: [g.id] })),
      );
      for (const response of simultaneous) await expect(response);
      const assigned = await expect(await get(apiUrl, "/api/cohorts", admin.cookie));
      assert.equal(assigned.filter((g) => g.courseIds.includes(course.id)).length, 1);
      await expect(
        await send("PATCH", `/api/courses/${course.id}`, { cohortIds: groups.slice(0, 2).map((g) => g.id) }),
      );
    });
    const csvEmail = `${unique}-csv@example.org`;
    const payload = {
      requestId: randomUUID(),
      csv: `\uFEFFФИО;Почта;Группа\r\n"Иван; Примеров";${csvEmail};${groups[0].name}\r\nДубликат;${csvEmail};${groups[0].name}\r\nОшибка;bad-email;${groups[0].name}`,
      columns: { name: 0, email: 1, group: 2 },
      sendInvitations: false,
    };
    await t.test("CSV: BOM, кавычки, mapping, ошибки строк и идемпотентность", async () => {
      const preview = await expect(await send("POST", "/api/users/import/preview", payload));
      assert.equal(preview.created, 1);
      assert.equal(preview.errors, 1);
      assert.equal(preview.skipped, 1);
      const first = await expect(await send("POST", "/api/users/import", payload));
      assert.deepEqual(first, preview);
      assert.deepEqual(await expect(await send("POST", "/api/users/import", payload)), first);
      assert.equal(
        (await send("POST", "/api/users/import", { ...payload, group: groups[1].name })).status,
        409,
      );
      const again = await expect(
        await send("POST", "/api/users/import", { ...payload, requestId: randomUUID() }),
      );
      assert.equal(again.created, 0);
      const moved = await expect(
        await send("POST", "/api/users/import", {
          ...payload,
          requestId: randomUUID(),
          group: groups[1].name,
          updateExisting: true,
        }),
      );
      assert.equal(moved.updated, 1);
      const users = await expect(await get(apiUrl, "/api/users", admin.cookie));
      const user = users.find((u) => u.email === csvEmail);
      createdUsers.push({ user });
      assert.equal(user.name, "Иван; Примеров");
      assert.equal(user.group, groups[1].name);
      assert.equal(user.role, "student");
      assert.equal(
        (
          await send("POST", "/api/users/import/preview", {
            ...payload,
            requestId: randomUUID(),
            columns: { name: 0, email: 1, role: 2 },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await send("POST", "/api/users/import/preview", {
            ...payload,
            requestId: randomUUID(),
            csv: 'name,email\n"broken',
          })
        ).status,
        400,
      );
      if (process.env.TEST_WEB_URL) {
        const webAdmin = await login(process.env.TEST_WEB_URL, "admin@pspu.ru");
        assert.equal(
          (
            await send(
              "POST",
              "/api/users/import/preview",
              { ...payload, requestId: randomUUID() },
              webAdmin,
              process.env.TEST_WEB_URL,
            )
          ).status,
          200,
        );
        assert.equal(
          (await get(process.env.TEST_WEB_URL, "/api/mail/settings", webAdmin.cookie)).status,
          200,
        );
      }
    });
    await t.test("SMTP: пароль не возвращается, проверка и тестовое письмо", async () => {
      const saved = await expect(await send("PUT", "/api/mail/settings", settings));
      assert.equal(saved.hasPassword, true);
      assert.equal(JSON.stringify(saved).includes(settings.password), false);
      assert.equal("password" in saved || "secret" in saved, false);
      assert.equal((await expect(await send("POST", "/api/mail/check", {}))).state, "connected");
      assert.equal(
        (await expect(await send("POST", "/api/mail/check", { email: "test@example.org" }))).state,
        "connected",
      );
      assert.equal(fixture.messages.length, 1);
      await expect(await send("PUT", "/api/mail/settings", { ...settings, password: undefined }));
    });
    let campaign;
    await t.test("аудитория исключает повторения, запрос не запускает рассылку повторно", async () => {
      const audience = {
        userIds: [createdUsers[0].user.id, createdUsers[0].user.id],
        cohortIds: [groups[0].id, groups[1].id, groups[1].id],
      };
      const count = await expect(await send("POST", "/api/mail/audience", audience));
      assert.equal(count.count, 3);
      const input = {
        requestId: randomUUID(),
        audience,
        subject: "Тестовая рассылка",
        text: "Текст письма",
        html: "<p>Текст письма</p>",
      };
      campaign = await expect(await send("POST", "/api/mail/campaigns", input));
      assert.equal(campaign.total, 3);
      assert.equal((await expect(await send("POST", "/api/mail/campaigns", input))).id, campaign.id);
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const list = await expect(await get(apiUrl, "/api/mail/campaigns", admin.cookie));
        campaign = list.find((c) => c.id === campaign.id);
        if (campaign.pending === 0) break;
        await delay(300);
      }
      assert.equal(campaign.status, "completed");
      assert.equal(campaign.sent, 3);
      assert.equal(fixture.messages.length, 4);
      const accepted = fixture.messages.slice(-3);
      for (let i = 1; i < accepted.length; i++)
        assert.ok(
          accepted[i].at - accepted[i - 1].at >= 900,
          "Общий лимит отправки: не чаще одного письма в секунду",
        );
    });
    await t.test("приглашение и одноразовая активация без раскрытия пароля", async () => {
      // Новый CSV с отправкой приглашения обходит ручной повтор и связан с отчётом импорта.
      const email = `${unique}-activation@example.org`;
      const result = await expect(
        await send("POST", "/api/users/import", {
          requestId: randomUUID(),
          csv: `name,email\nНовый Студент,${email}`,
          sendInvitations: true,
        }),
      );
      assert.equal(result.created, 1);
      const users = await expect(await get(apiUrl, "/api/users", admin.cookie));
      createdUsers.push({ user: users.find((u) => u.email === email) });
      const deadline = Date.now() + 15000;
      while (!fixture.messages.some((m) => m.recipient === email) && Date.now() < deadline) await delay(300);
      const message = fixture.messages.find((m) => m.recipient === email);
      assert.ok(message);
      const token = message.body
        .replaceAll(/=\r\n/g, "")
        .replaceAll("=3D", "=")
        .match(/token=([A-F0-9]{64})/)?.[1];
      assert.ok(token);
      const activation = { token, password: "ExamplePassword2026" };
      const simultaneous = await Promise.all([
        send("POST", "/api/auth/activate", activation),
        send("POST", "/api/auth/activate", activation),
      ]);
      assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 400]);
      const actor = await login(apiUrl, email, activation.password);
      assert.equal(actor.user.mustChangePassword, undefined);
    });
    await t.test("постоянная SMTP-ошибка отражается в истории", async () => {
      // Запрос с другим идентификатором — новая осознанная операция.
      fixture.setMode("permanent");
      const failed = await expect(
        await send("POST", "/api/mail/campaigns", {
          requestId: randomUUID(),
          audience: { userIds: [createdUsers[0].user.id] },
          subject: "Ошибка SMTP",
          text: "Тест",
        }),
      );
      const deadline = Date.now() + 15000;
      let rows;
      do {
        rows = await expect(await get(apiUrl, `/api/mail/campaigns/${failed.id}`, admin.cookie));
        if (rows[0]?.status === "failed") break;
        await delay(300);
      } while (Date.now() < deadline);
      assert.equal(rows[0].status, "failed");
      assert.equal(rows[0].attempts, 1);
      assert.ok(rows[0].error);
      assert.equal(rows[0].error.includes(settings.password), false);
    });
    await t.test("временный отказ SMTP повторяется с задержкой и не дублирует принятое письмо", async () => {
      fixture.setMode("temporary");
      const campaign = await expect(
        await send("POST", "/api/mail/campaigns", {
          requestId: randomUUID(),
          audience: { userIds: [createdUsers[0].user.id] },
          subject: "Повтор SMTP",
          text: "Тест повтора",
        }),
      );
      let rows;
      const firstDeadline = Date.now() + 15000;
      do {
        rows = await expect(await get(apiUrl, `/api/mail/campaigns/${campaign.id}`, admin.cookie));
        if (rows[0]?.attempts > 0 && rows[0]?.status !== "sending") break;
        await delay(300);
      } while (Date.now() < firstDeadline);
      assert.equal(rows[0].status, "queued");
      assert.equal(rows[0].attempts, 1);
      fixture.setMode("ok");
      const deadline = Date.now() + 45000;
      do {
        rows = await expect(await get(apiUrl, `/api/mail/campaigns/${campaign.id}`, admin.cookie));
        if (rows[0]?.status === "sent") break;
        await delay(500);
      } while (Date.now() < deadline);
      assert.equal(rows[0].status, "sent");
      assert.equal(rows[0].attempts, 2);
    });
    await t.test("автособытия, исключение удалённых групп и отзыв старой ссылки", async () => {
      await expect(
        await send("PUT", "/api/mail/settings", {
          ...settings,
          userCreated: true,
          invitation: true,
          groupAdded: true,
          courseAssigned: true,
          coursePublished: true,
        }),
      );
      const email = `${unique}-auto@example.org`;
      const user = await expect(
        await send("POST", "/api/users", {
          name: "Авто Студент",
          email,
          role: "student",
          group: groups[0].name,
        }),
        201,
      );
      createdUsers.push(user);
      const deadline = Date.now() + 15000;
      while (fixture.messages.filter((m) => m.recipient === email).length < 4 && Date.now() < deadline)
        await delay(300);
      const received = fixture.messages.filter((m) => m.recipient === email);
      assert.equal(received.length, 4);
      const token = received
        .map(
          (m) =>
            m.body
              .replaceAll(/=\r\n/g, "")
              .replaceAll("=3D", "=")
              .match(/token=([A-F0-9]{64})/)?.[1],
        )
        .find(Boolean);
      assert.ok(token);
      const before = await expect(await get(apiUrl, "/api/mail/campaigns", admin.cookie));
      await expect(await send("PATCH", `/api/users/${user.user.id}`, { group: groups[0].name }));
      const after = await expect(await get(apiUrl, "/api/mail/campaigns", admin.cookie));
      assert.equal(after.length, before.length);
      await expect(await send("POST", `/api/users/${user.user.id}/password-reset`, {}));
      assert.equal(
        (await send("POST", "/api/auth/activate", { token, password: "AnotherPassword2026" })).status,
        400,
      );
      await expect(await send("PATCH", `/api/courses/${course.id}`, { status: "draft" }));
      await expect(
        await send("PATCH", `/api/courses/${course.id}`, { status: "published", cohortIds: [groups[2].id] }),
      );
      const history = await expect(await get(apiUrl, "/api/mail/campaigns", admin.cookie));
      const publication = history.find(
        (m) => m.subject === "Опубликован курс" && !before.some((old) => old.id === m.id),
      );
      assert.ok(publication);
      const recipients = await expect(
        await get(apiUrl, `/api/mail/campaigns/${publication.id}`, admin.cookie),
      );
      assert.deepEqual(
        recipients.map((r) => r.email),
        [createdUsers[2].user.email],
      );
    });
  } finally {
    fixture.setMode("ok");
    // Выключить события прежде, чем удалять тестовые сущности. Реальные SMTP-секреты в тестах не используются.
    await send("PUT", "/api/mail/settings", {
      ...settings,
      ...previousSmtp,
      host: previousSmtp.host || "localhost",
      fromEmail: previousSmtp.fromEmail || "test@example.org",
      security: previousSmtp.host ? previousSmtp.security : "none",
      username: "",
      userCreated: false,
      invitation: false,
      courseAssigned: false,
      groupAdded: false,
      coursePublished: false,
    });
    if (course) await send("DELETE", `/api/courses/${course.id}`);
    for (const result of createdUsers) if (result.user) await send("DELETE", `/api/users/${result.user.id}`);
    for (const group of groups) await send("DELETE", `/api/cohorts/${group.id}`);
    await fixture.close();
  }
});
