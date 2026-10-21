import { backendRequest, isSameOrigin } from "@/shared/lib/backend";

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  return (
    (await backendRequest("/api/auth/logout", { method: "POST" })) ??
    Response.json({ error: "Бэкенд не подключён" }, { status: 503 })
  );
}
