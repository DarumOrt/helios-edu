import { NextResponse } from "next/server";
import { getSubmission, reviewSubmission } from "@/mocks/submissions-store";

// POST { grade, feedback } — оценка работы. Доступ к курсу проверяет proxy.ts (серверный режим).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  return NextResponse.json(reviewSubmission(id, grade as number, feedback as string));
}
