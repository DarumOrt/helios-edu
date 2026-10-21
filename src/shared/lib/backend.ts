import "server-only";

// URL доступен только серверу Next.js; браузер продолжает обращаться к /api/*.
export async function backendGet(path: string): Promise<Response | null> {
  const baseUrl = process.env.BACKEND_API_URL;
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    // При включённом бэкенде не подменяем сбой моками: иначе проблема останется незаметной.
    return Response.json({ error: "Сервис обучения временно недоступен" }, { status: 503 });
  }
}
