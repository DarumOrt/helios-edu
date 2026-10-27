import { audit, auditIfOk } from "@/mocks/audit-store";
import { NextResponse } from "next/server";
import { setGrade } from "@/mocks/gradebook-store";
import { backendForward } from "@/shared/lib/backend";
import { demoCourseReviewer, readJson } from "@/mocks/management-guards";

// POST { courseId, userId, itemId, grade } — оценка в журнале (grade: null — снять). Сервер — C#.
export async function POST(req: Request) {
  const forwarded = await backendForward(req, "/api/gradebook/grade");
  if (forwarded) return auditIfOk(forwarded, "Изменена оценка", "через сервер");
  const body = (await readJson(req)) as {
    courseId?: unknown;
    userId?: unknown;
    itemId?: unknown;
    grade?: unknown;
  } | null;
  if (
    !body ||
    typeof body.courseId !== "string" ||
    typeof body.userId !== "string" ||
    typeof body.itemId !== "string"
  )
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  // как в C#: ставит администратор или преподаватель своего курса
  const access = await demoCourseReviewer("grade.edit", body.courseId);
  if (access instanceof NextResponse) return access;
  const grade = body.grade ?? null;
  if (grade !== null && (typeof grade !== "number" || !Number.isFinite(grade) || grade < 0))
    return NextResponse.json(
      { error: "Проверьте поля формы", fields: { grade: "Оценка — неотрицательное число" } },
      { status: 400 },
    );
  const row = setGrade(body.courseId, body.userId, body.itemId, grade);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  await audit("Изменена оценка", `${row.userName} · ${body.courseId} · ${body.itemId}: ${body.grade ?? "—"}`);
  return NextResponse.json(row);
}
