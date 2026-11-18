import { backendForward, serverOnly } from "@/shared/lib/backend";

export async function GET(request: Request) {
  return (await backendForward(request, "/api/branding")) ?? Response.json({});
}

export async function PUT(request: Request) {
  if (Number(request.headers.get("content-length")) > 1_420_000)
    return Response.json({ error: "Слишком большой файл" }, { status: 413 });
  return (await backendForward(request, "/api/branding")) ?? serverOnly();
}
