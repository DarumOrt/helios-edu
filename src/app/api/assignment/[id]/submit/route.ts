import { NextResponse } from "next/server";
import { submitAssignment } from "@/mocks/submissions-store";
import { findActivity } from "@/mocks/course-store";
import { backendForward } from "@/shared/lib/backend";

// POST { courseId, userId, text, fileName? } — сдать задание. Сервер — C# (Grades/GradesEndpoints.cs,
// ученик из сессии), демо — моки ниже.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/assignment/${encodeURIComponent(id)}/submit`);
  if (forwarded) return forwarded;
  let body: { courseId?: unknown; userId?: unknown; text?: unknown; fileName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (typeof body.courseId !== "string" || typeof body.userId !== "string")
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  if (findActivity(body.courseId, id)?.activity.type !== "assignment")
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : undefined;
  if (!text && !fileName)
    return NextResponse.json(
      { error: "Добавьте ответ или файл", fields: { text: "Добавьте ответ или файл" } },
      { status: 400 },
    );
  if (text.length > 20000)
    return NextResponse.json(
      { error: "Ответ — до 20 000 символов", fields: { text: "Ответ — до 20 000 символов" } },
      { status: 400 },
    );

  try {
    const saved = submitAssignment({
      courseId: body.courseId,
      assignmentId: id,
      userId: body.userId,
      text,
      fileName,
    });
    return NextResponse.json({ id: saved.id, status: saved.status }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Работа уже проверена — пересдать её нельзя" }, { status: 409 });
  }
}
