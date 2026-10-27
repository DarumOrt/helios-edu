import { NextResponse } from "next/server";
import { submitAssignment } from "@/mocks/submissions-store";
import { findActivity } from "@/mocks/course-store";
import { backendForward } from "@/shared/lib/backend";
import { getDemoActor } from "@/mocks/demo-actor";
import { visibleDemoCourses } from "@/mocks/demo-courses";

// POST { courseId, text, fileName? } — сдать задание. Ученик в обоих режимах — тот, кто вошёл
// (userId из тела не используется). Сервер — C# (Grades/GradesEndpoints.cs), демо — моки ниже.
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
  if (typeof body.courseId !== "string")
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const actor = await getDemoActor();
  if (actor.role !== "student") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  const courseId = body.courseId;
  if (
    !(await visibleDemoCourses()).some((c) => c.id === courseId) ||
    findActivity(courseId, id)?.activity.type !== "assignment"
  )
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
      courseId,
      assignmentId: id,
      userId: actor.id,
      text,
      fileName,
    });
    return NextResponse.json({ id: saved.id, status: saved.status }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Работа уже проверена — пересдать её нельзя" }, { status: 409 });
  }
}
