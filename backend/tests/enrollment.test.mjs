import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { apiUrl, get, login } from "./client.mjs";

for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: преподаватель создаёт курс, назначает группы, записывает индивидуально и по слову`, async () => {
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const organizer = await login(baseUrl, "organizer@pspu.ru");
    const stranger = await login(baseUrl, "tutor2@pspu.ru");
    const student = await login(baseUrl);
    const unique = randomUUID().slice(0, 8);
    const code = [...randomBytes(6)].map((b) => String.fromCharCode(65 + (b % 26))).join("") + "-456";
    const send = (actor, method, path, body) =>
      fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Cookie: actor.cookie,
          Origin: new URL(baseUrl).origin,
          "Content-Type": "application/json",
          "X-Helios-Client": "web",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
      });
    const expect = async (response, status = 200) => {
      const text = await response.text();
      assert.equal(response.status, status, text);
      return text ? JSON.parse(text) : null;
    };
    const users = [],
      groups = [];
    let course;
    try {
      const payload = { code, title: `Курс преподавателя ${unique}`, category: "Практика", description: "" };
      await expect(await send(student, "POST", "/api/courses", payload), 403);
      await expect(await send(tutor, "POST", "/api/courses", { ...payload, tutorId: stranger.user.id }), 403);
      course = await expect(await send(tutor, "POST", "/api/courses", payload), 201);
      assert.equal(course.tutorId, tutor.user.id);
      assert.equal(course.status, "draft");
      const root = `/api/courses/${course.id}`;
      await expect(await get(baseUrl, `${root}/enrollment`, stranger.cookie), 404);
      await expect(await get(baseUrl, `${root}/enrollment`, student.cookie), 403);
      for (let i = 0; i < 2; i++)
        groups.push(
          await expect(await send(organizer, "POST", "/api/cohorts", { name: `З-${unique}-${i}` }), 201),
        );
      for (let i = 0; i < 4; i++)
        users.push(
          await expect(
            await send(organizer, "POST", "/api/users", {
              name: `Запись Фамилия${unique} ${i}`,
              email: `enrollment-${unique}-${i}@example.org`,
              role: "student",
              ...(i < 2 ? { group: groups[i].name } : {}),
            }),
            201,
          ),
        );
      const manual = await login(baseUrl, users[2].user.email, users[2].temporaryPassword);
      const self = await login(baseUrl, users[3].user.email, users[3].temporaryPassword);
      await expect(
        await send(tutor, "PATCH", root, { cohortIds: groups.map((g) => g.id), status: "published" }),
      );
      await expect(await send(tutor, "PATCH", root, { cohortIds: ["missing"] }), 400);
      await expect(await send(tutor, "PATCH", root, { tutorId: stranger.user.id }), 403);
      let info = await expect(await get(baseUrl, `${root}/enrollment`, tutor.cookie));
      assert.equal(info.students.length, 2);
      assert.ok(info.students.every((s) => s.source === "group"));
      const search = await expect(
        await get(
          baseUrl,
          `${root}/enrollment/students?q=${encodeURIComponent(`Фамилия${unique}`)}`,
          tutor.cookie,
        ),
      );
      assert.equal(search.length, 4);
      assert.ok(search.some((s) => s.email === manual.user.email));
      const byEmail = await expect(
        await get(
          baseUrl,
          `${root}/enrollment/students?q=${encodeURIComponent(manual.user.email)}`,
          tutor.cookie,
        ),
      );
      assert.deepEqual(
        byEmail.map((s) => s.id),
        [manual.user.id],
      );
      await expect(
        await send(stranger, "POST", `${root}/enrollment/students`, { userId: manual.user.id }),
        404,
      );
      await expect(
        await send(student, "POST", `${root}/enrollment/students`, { userId: manual.user.id }),
        403,
      );
      await expect(
        await send(tutor, "POST", `${root}/enrollment/students`, { userId: stranger.user.id }),
        400,
      );
      await Promise.all(
        [1, 2].map(async () =>
          expect(await send(tutor, "POST", `${root}/enrollment/students`, { userId: manual.user.id })),
        ),
      );
      assert.equal((await expect(await get(baseUrl, root, manual.cookie))).id, course.id);
      assert.equal((await expect(await get(baseUrl, "/api/auth/me", manual.cookie))).group, undefined);
      await expect(await send(self, "POST", `${root}/enroll`, { keyword: "секрет" }), 403);
      for (const keyword of ["", "кот", true, "я".repeat(65)]) {
        const bad = await expect(await send(tutor, "PUT", `${root}/enrollment/key`, { keyword }), 400);
        assert.equal(bad.fields.keyword, "Кодовое слово — от 4 до 64 символов");
      }
      await expect(await send(tutor, "PUT", `${root}/enrollment/key`, { keyword: "Секрет 2026" }));
      const catalog = (await expect(await get(baseUrl, "/api/catalog", self.cookie))).find(
        (c) => c.id === course.id,
      );
      assert.equal(catalog.selfEnrollment, true);
      assert.equal(catalog.accessible, false);
      assert.ok(!JSON.stringify(catalog).includes("Секрет"));
      const bad = await expect(
        await send(self, "POST", `${root}/enroll`, {
          keyword: "секрет 2026",
          userId: manual.user.id,
          role: "tutor",
        }),
        400,
      );
      assert.equal(bad.fields.keyword, "Неверное кодовое слово");
      await expect(await send(student, "PUT", `${root}/enrollment/key`, { keyword: "Другое" }), 403);
      await expect(await send(stranger, "PUT", `${root}/enrollment/key`, { keyword: "Другое" }), 404);
      await expect(await send(tutor, "POST", `${root}/enroll`, { keyword: "Секрет 2026" }), 403);
      await Promise.all(
        [1, 2].map(async () =>
          expect(
            await send(self, "POST", `${root}/enroll`, {
              keyword: "  Секрет 2026  ",
              userId: student.user.id,
            }),
          ),
        ),
      );
      assert.equal((await expect(await get(baseUrl, root, self.cookie))).id, course.id);
      info = await expect(await get(baseUrl, `${root}/enrollment`, tutor.cookie));
      assert.equal(info.students.length, 4);
      assert.equal(info.students.find((s) => s.id === self.user.id).source, "self");
      assert.equal(info.students.find((s) => s.id === manual.user.id).source, "manual");
      assert.ok(!info.students.some((s) => s.id === student.user.id));
      assert.equal((await expect(await get(baseUrl, root, tutor.cookie))).enrolled, 4);
      // Повторная запись через другой способ не удваивает участника; снятие группы не отнимает индивидуальную запись.
      await expect(await send(tutor, "POST", `${root}/enrollment/students`, { userId: users[0].user.id }));
      assert.equal((await expect(await get(baseUrl, root, tutor.cookie))).enrolled, 4);
      await expect(await send(tutor, "PATCH", root, { cohortIds: [] }));
      info = await expect(await get(baseUrl, `${root}/enrollment`, tutor.cookie));
      assert.equal(info.students.length, 3);
      await expect(await send(tutor, "PUT", `${root}/enrollment/key`, { keyword: "Новый секрет" }));
      await expect(await send(student, "POST", `${root}/enroll`, { keyword: "Секрет 2026" }), 400);
      await expect(await send(tutor, "PUT", `${root}/enrollment/key`, { keyword: null }));
      await expect(await send(student, "POST", `${root}/enroll`, { keyword: "Новый секрет" }), 403);
      await expect(await get(baseUrl, root, self.cookie));
      await expect(await send(tutor, "PATCH", root, { status: "archived" }));
      await expect(await get(baseUrl, root, self.cookie), 404);
      await expect(await send(student, "POST", `${root}/enroll`, { keyword: "Новый секрет" }), 404);
    } finally {
      if (course) {
        await send(tutor, "PATCH", `/api/courses/${course.id}`, { cohortIds: [] });
        await send(tutor, "DELETE", `/api/courses/${course.id}`);
      }
      for (const group of groups) await send(organizer, "DELETE", `/api/cohorts/${group.id}`);
      for (const user of users) await send(organizer, "DELETE", `/api/users/${user.user.id}`);
    }
  });
}
