import { backendRequest, isSameOrigin } from "@/shared/lib/backend";

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  return (
    (await backendRequest("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })) ?? Response.json({ error: "Вход доступен при подключённом бэкенде" }, { status: 503 })
  );
}
