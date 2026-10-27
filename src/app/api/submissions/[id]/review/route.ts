import { audit, auditIfOk } from "@/mocks/audit-store";
import { NextResponse } from "next/server";
import { getSubmission, reviewSubmission } from "@/mocks/submissions-store";
import { backendForward } from "@/shared/lib/backend";
import { addPersonal } from "@/mocks/announcements-store";
import { setGrade } from "@/mocks/gradebook-store";

// POST { grade, feedback } — оценка работы. Сервер — C# (права и курс проверяет он), демо — моки ниже.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/submissions/${encodeURIComponent(id)}/review`);
  if (forwarded) return auditIfOk(forwarded, "Проверена работа", id);
  const submission = getSubmission(id);
  if (!submission) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: { grade?: unknown; feedback?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const grade = body.grade;
  const feedback = body.feedback ?? "";
  const fields: Record<string, string> = {};
  if (typeof grade !== "number" || !Number.isFinite(grade) || grade < 0 || grade > submission.maxGrade)
    fields.grade = `Оценка — число от 0 до ${submission.maxGrade}`;
  if (typeof feedback !== "string" || feedback.length > 2000)
    fields.feedback = "Комментарий — до 2000 символов";
  if (Object.keys(fields).length)
    return NextResponse.json({ error: "Проверьте поля формы", fields }, { status: 400 });

  await audit(
    "Проверена работа",
    `${submission.userName} · ${submission.assignmentTitle} · ${grade}/${submission.maxGrade}`,
  );
  // ученик узнаёт об оценке в колокольчике — как в C# (Notifications)
  addPersonal(submission.userId, {
    type: "grade",
    title: "Оценка выставлена",
    body: `${submission.assignmentTitle}: ${grade} из ${submission.maxGrade}`,
    link: "/gradebook",
  });
  // оценка за работу — в журнал, как SaveGrade в C#
  setGrade(submission.courseId, submission.userId, submission.assignmentId, grade as number);
  return NextResponse.json(reviewSubmission(id, grade as number, feedback as string));
}
