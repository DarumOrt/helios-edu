import { NextResponse } from "next/server";
import { backendForward } from "@/shared/lib/backend";
import { FILES_SERVER_ONLY } from "@/shared/lib/file-rules";

// POST { kind, courseId, fileName, size } — ссылка на загрузку файла в хранилище (C#: Files/FilesEndpoints.cs).
// Файлы — только в режиме «Сервер»: в демо хранилища нет.
export async function POST(req: Request) {
  const forwarded = await backendForward(req, "/api/files");
  return forwarded ?? NextResponse.json({ error: FILES_SERVER_ONLY }, { status: 501 });
}
