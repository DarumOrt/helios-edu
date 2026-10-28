import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { promisify } from "node:util";
import { apiUrl, get, login } from "./client.mjs";

// Файлы курсов в хранилище (Files/FilesEndpoints.cs, docs/backend/p6-files.md): ссылка на загрузку,
// загрузка напрямую в хранилище, подтверждение, чтение с проверкой прав, привязка к материалу,
// обложке и работе, корзина. Напрямую в C# — всё; через Next — основной путь.

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

const MB = 1024 * 1024;
const bytes = (size) => new Uint8Array(size).map((_, i) => i % 251);

function client(baseUrl) {
  const origin = new URL(baseUrl).origin;
  const send = (actor, method, path, body) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Cookie: actor.cookie,
        "Content-Type": "application/json",
        "X-Helios-Client": "web",
        Origin: origin,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
  const expect = async (response, status) => {
    const text = await response.text();
    assert.equal(response.status, status, text);
    return text ? JSON.parse(text) : null;
  };
  /** Полная загрузка: ссылка → PUT в хранилище → подтверждение */
  const upload = async (actor, kind, courseId, fileName, content = bytes(1000)) => {
    const ticket = await expect(
      await send(actor, "POST", "/api/files", { kind, courseId, fileName, size: content.length }),
      201,
    );
    const put = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": ticket.contentType },
      body: content,
    });
    assert.equal(put.status, 200);
    return expect(await send(actor, "POST", `/api/files/${ticket.id}/complete`, {}), 200);
  };
  return { send, expect, upload };
}

for (const [name, baseUrl] of [
  ["C#", apiUrl],
  ...(process.env.TEST_WEB_URL ? [["Next.js", process.env.TEST_WEB_URL]] : []),
]) {
  test(`${name}: загрузка видео, чтение по правам и перемотка`, async () => {
    const { send, expect, upload } = client(baseUrl);
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const student = await login(baseUrl);
    const outsider = await login(baseUrl, "student4@student.pspu.ru");

    // форматы, лимиты и права — до выдачи ссылки
    const fields = async (body, actor = tutor) =>
      (await expect(await send(actor, "POST", "/api/files", body), 400)).fields;
    assert.equal(
      (await fields({ kind: "audio", courseId: "c-dor-ai", fileName: "a.mp3", size: 10 })).kind,
      "Неизвестный вид файла",
    );
    assert.equal(
      (await fields({ kind: "video", courseId: "c-dor-ai", fileName: "a.avi", size: 10 })).fileName,
      "Этот формат не подходит. Можно: mp4, webm",
    );
    assert.equal(
      (await fields({ kind: "cover", courseId: "c-dor-ai", fileName: "c.png", size: 6 * MB })).size,
      "Файл больше 5 МБ",
    );
    assert.equal(
      (await fields({ kind: "document", courseId: "c-dor-ai", fileName: "d.pdf", size: 0 })).size,
      "Файл пустой",
    );
    assert.equal(
      (
        await send(student, "POST", "/api/files", {
          kind: "video",
          courseId: "c-dor-ai",
          fileName: "v.mp4",
          size: 10,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await send(tutor, "POST", "/api/files", {
          kind: "video",
          courseId: "c-ai-teaching",
          fileName: "v.mp4",
          size: 10,
        })
      ).status,
      404,
      "чужой курс преподавателю не виден",
    );

    // подтвердить до загрузки нельзя; подтверждает только тот, кто загружал
    const content = bytes(300_000);
    const ticket = await expect(
      await send(tutor, "POST", "/api/files", {
        kind: "video",
        courseId: "c-dor-ai",
        fileName: "Лекция 1.mp4",
        size: content.length,
      }),
      201,
    );
    assert.equal(ticket.contentType, "video/mp4");
    assert.equal((await send(tutor, "POST", `/api/files/${ticket.id}/complete`, {})).status, 409);
    await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": ticket.contentType },
      body: content,
    });
    assert.equal((await send(student, "POST", `/api/files/${ticket.id}/complete`, {})).status, 404);
    const file = await expect(await send(tutor, "POST", `/api/files/${ticket.id}/complete`, {}), 200);
    assert.deepEqual(
      [file.fileName, file.size, file.url],
      ["Лекция 1.mp4", content.length, `/api/files/${ticket.id}`],
    );

    // ученик курса открывает файл — перенаправление на временную ссылку, перемотка работает; чужой — 404
    const open = await send(student, "GET", file.url);
    assert.equal(open.status, 302);
    const part = await fetch(open.headers.get("location"), { headers: { Range: "bytes=1000-1999" } });
    assert.equal(part.status, 206);
    const chunk = new Uint8Array(await part.arrayBuffer());
    assert.deepEqual([chunk.length, chunk[0]], [1000, 1000 % 251]);
    assert.match(part.headers.get("content-disposition"), /filename\*=UTF-8''%D0%9B/);
    assert.equal((await send(outsider, "GET", file.url)).status, 404);
    assert.equal((await get(baseUrl, file.url)).status, 401);

    // материал ссылается только на загруженный файл своего курса и подходящего вида
    const course = await expect(await send(tutor, "GET", "/api/courses/c-dor-ai"), 200);
    const root = `/api/courses/c-dor-ai/sections/${course.sections[0].id}/activities`;
    const activity = await expect(
      await send(tutor, "POST", root, { type: "video", title: `Видео из хранилища ${name}`, src: file.url }),
      201,
    );
    assert.equal(activity.src, file.url);
    for (const [type, src] of [
      ["video", "/api/files/f-no-such"],
      ["pdf", file.url],
    ])
      assert.equal(
        (await expect(await send(tutor, "POST", root, { type, title: "Не тот файл", src, pages: 3 }), 400))
          .fields.src,
        "Файл не найден — загрузите его ещё раз",
      );
    assert.equal(
      (await send(tutor, "DELETE", `/api/courses/c-dor-ai/activities/${activity.id}`)).status,
      204,
    );
  });

  test(`${name}: обложка — цвет и картинка сохраняются на сервере`, async () => {
    const { send, expect, upload } = client(baseUrl);
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const before = await expect(await send(tutor, "GET", "/api/courses/c-dor-ai"), 200);
    const cover = await upload(tutor, "cover", "c-dor-ai", "обложка.png");
    try {
      const saved = await expect(
        await send(tutor, "PUT", "/api/courses/c-dor-ai/cover", { coverColor: "teal", cover: cover.url }),
        200,
      );
      assert.deepEqual([saved.coverColor, saved.cover], ["teal", cover.url]);
      const reread = await expect(await send(tutor, "GET", "/api/courses/c-dor-ai"), 200);
      assert.deepEqual([reread.coverColor, reread.cover], ["teal", cover.url]);
      const errors = (
        await expect(await send(tutor, "PUT", "/api/courses/c-dor-ai/cover", { coverColor: "black" }), 400)
      ).fields;
      assert.equal(errors.coverColor, "Неизвестный цвет обложки");
      assert.equal(
        (
          await expect(
            await send(tutor, "PUT", "/api/courses/c-dor-ai/cover", { cover: "https://example.com/c.png" }),
            400,
          )
        ).fields.cover,
        "Картинка не найдена — загрузите её ещё раз",
      );
    } finally {
      await expect(
        await send(tutor, "PUT", "/api/courses/c-dor-ai/cover", {
          coverColor: before.coverColor,
          cover: null,
        }),
        200,
      );
    }
  });

  test(`${name}: файл к заданию видят автор и преподаватель курса`, async () => {
    const { send, expect, upload } = client(baseUrl);
    const student = await login(baseUrl, "student13@student.pspu.ru");
    const classmate = await login(baseUrl, "student14@student.pspu.ru");
    const tutor = await login(baseUrl, "tutor@pspu.ru");
    const work = await upload(student, "submission", "c-dor-ai", "Отчёт.docx");
    // чужой файл к своей работе не прикрепить
    assert.equal(
      (
        await expect(
          await send(classmate, "POST", "/api/assignment/ma1/submit", {
            courseId: "c-dor-ai",
            fileId: work.id,
          }),
          400,
        )
      ).fields.fileId,
      "Файл не найден — загрузите его ещё раз",
    );
    const submitted = await send(student, "POST", "/api/assignment/ma1/submit", {
      courseId: "c-dor-ai",
      fileId: work.id,
    });
    // повторный прогон на той же базе: работа могла быть уже проверена
    if (submitted.status === 409) return;
    assert.equal(submitted.status, 201);
    const mine = await expect(
      await send(student, "GET", "/api/assignment/ma1/submission?courseId=c-dor-ai"),
      200,
    );
    assert.deepEqual([mine.submission.fileId, mine.submission.fileName], [work.id, "Отчёт.docx"]);
    assert.equal((await send(student, "GET", work.url)).status, 302);
    assert.equal((await send(tutor, "GET", work.url)).status, 302);
    assert.equal((await send(classmate, "GET", work.url)).status, 404);
  });
}

test("C#: корзина — неиспользуемый файл через сутки в корзине, через 7 дней удалён", async () => {
  const { send, expect, upload } = client(apiUrl);
  const tutor = await login(apiUrl, "tutor@pspu.ru");
  const admin = await login(apiUrl, "admin@pspu.ru");
  const file = await upload(tutor, "document", "c-dor-ai", "Конспект.pdf");
  const location = (await send(tutor, "GET", file.url)).headers.get("location");
  const cleanup = () => send(admin, "POST", "/api/files/cleanup", {});
  assert.equal((await cleanup()).status, 200);
  assert.equal((await send(tutor, "POST", "/api/files/cleanup", {})).status, 403);
  const status = () => sql(`SELECT "Status" FROM "Files" WHERE "Id" = '${file.id}'`);
  assert.equal(await status(), "ready", "свежий файл ждёт сутки — его могут ещё прикрепить");

  await sql(`UPDATE "Files" SET "ReadyAt" = now() - interval '2 days' WHERE "Id" = '${file.id}'`);
  assert.ok((await expect(await cleanup(), 200)).trashed >= 1);
  assert.equal(await status(), "trash");
  assert.equal((await send(tutor, "GET", file.url)).status, 404, "из корзины файл не открывается");

  await sql(`UPDATE "Files" SET "TrashedAt" = now() - interval '8 days' WHERE "Id" = '${file.id}'`);
  assert.ok((await expect(await cleanup(), 200)).deleted >= 1);
  assert.equal(await status(), "");
  assert.equal((await fetch(location)).status, 404, "объект удалён из хранилища");
});
