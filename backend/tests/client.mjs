import assert from "node:assert/strict";

export const apiUrl = process.env.TEST_API_URL ?? "http://127.0.0.1:8080";
export const demoPassword = process.env.TEST_DEMO_PASSWORD ?? "HeliosDemo2026!";

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
