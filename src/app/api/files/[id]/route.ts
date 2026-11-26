import { NextResponse } from "next/server";
import { backendRequest } from "@/shared/lib/backend";
import { FILES_SERVER_ONLY } from "@/shared/lib/file-rules";

// GET — открыть файл: C# проверяет доступ и перенаправляет (302) на временную ссылку хранилища.
// Видео и PDF идут из хранилища напрямую, а не через Next.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const query = new URL(req.url).searchParams;
  const mode =
    query.get("download") === "1" ? "?download=1" : query.get("preview") === "1" ? "?preview=1" : "";
  const response = await backendRequest(`/api/files/${encodeURIComponent(id)}${mode}`);
  return response ?? NextResponse.json({ error: FILES_SERVER_ONLY }, { status: 404 });
}
