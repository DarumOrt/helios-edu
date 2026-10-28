import { NextResponse } from "next/server";
import { backendForward } from "@/shared/lib/backend";
import { FILES_SERVER_ONLY } from "@/shared/lib/file-rules";

// POST — браузер загрузил файл по ссылке; C# проверяет, что он на месте и размер совпал.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/files/${encodeURIComponent(id)}/complete`);
  return forwarded ?? NextResponse.json({ error: FILES_SERVER_ONLY }, { status: 501 });
}
