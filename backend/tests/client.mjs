import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { after } from "node:test";
import { setTimeout } from "node:timers/promises";

export const apiUrl = process.env.TEST_API_URL ?? "http://127.0.0.1:8080";
export const demoPassword = process.env.TEST_DEMO_PASSWORD ?? "HeliosDemo2026!";

// Файлы node --test запускаются параллельно, но lifecycle перезапускает общий API.
// Локальный сокет сериализует наборы; ОС освобождает его и при аварийном выходе.
const port = 40000 + (createHash("sha256").update(apiUrl).digest().readUInt16BE() % 20000);
const suiteLock = createServer();
for (let attempt = 0; ; attempt++) {
  try {
    await new Promise((resolve, reject) => {
      suiteLock.once("error", reject);
      suiteLock.listen(port, "127.0.0.1", () => {
        suiteLock.removeListener("error", reject);
        resolve();
      });
    });
    break;
  } catch (error) {
    suiteLock.removeAllListeners("listening");
    if (error.code !== "EADDRINUSE" || attempt >= 1200) throw error;
    await setTimeout(250);
  }
}
suiteLock.unref();
after(() => new Promise((resolve) => suiteLock.close(resolve)));

export async function login(baseUrl, email = "vagulin@student.pspu.ru", password = demoPassword) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Helios-Client": "web",
      Origin: new URL(baseUrl).origin,
    },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("helios-auth="));
  assert.ok(cookie);
  return { cookie: cookie.split(";")[0], user: await response.json(), setCookie: cookie };
}

export const get = (baseUrl, path, cookie) =>
  fetch(`${baseUrl}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
    signal: AbortSignal.timeout(10_000),
  });
