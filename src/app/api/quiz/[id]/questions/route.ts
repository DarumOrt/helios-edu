import { NextResponse } from "next/server";
import { getQuestions, publicQuestions } from "@/mocks/quiz-store";

// GET ?courseId= — вопросы для прохождения, без правильных ответов. Доступ к курсу проверяет proxy.ts.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = new URL(req.url).searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });
  return NextResponse.json(publicQuestions(getQuestions(courseId, id)));
}
