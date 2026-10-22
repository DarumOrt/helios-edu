import "server-only";
import { cookies } from "next/headers";

// URL доступен только серверу Next.js; браузер продолжает обращаться к /api/*.
export async function backendRequest(path: string, init?: RequestInit): Promise<Response | null> {
  const baseUrl = process.env.BACKEND_API_URL;
  if (!baseUrl) return null;

  try {
    const token = (await cookies()).get("helios-auth")?.value;
    const headers = new Headers(init?.headers);
    headers.set("X-Helios-Client", "web");
    if (token) headers.set("Cookie", `helios-auth=${token}`);
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    const responseHeaders = new Headers({
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store",
    });
    for (const cookie of response.headers.getSetCookie()) responseHeaders.append("Set-Cookie", cookie);
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    // При включённом бэкенде не подменяем сбой моками: иначе проблема останется незаметной.
    return Response.json({ error: "Сервис обучения временно недоступен" }, { status: 503 });
  }
}

export const backendGet = (path: string) => backendRequest(path);

export type BackendResult<T> = { ok: true; data: T } | { ok: false; response: Response };

// Доработка ответа API сохраняет серверную сессию, ошибки и новые обложки интерфейса.
export async function backendJson<T>(path: string): Promise<BackendResult<T> | null> {
  const response = await backendGet(path);
  if (!response) return null;
  if (!response.ok) return { ok: false, response };
  return { ok: true, data: (await response.json()) as T };
}

export function isSameOrigin(request: Request): boolean {
  try {
    const origin = request.headers.get("origin");
    const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.slice(0, -1);
    if (!origin || !["http", "https"].includes(protocol)) return false;
    const source = new URL(origin);
    return source.host === request.headers.get("host") && source.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
