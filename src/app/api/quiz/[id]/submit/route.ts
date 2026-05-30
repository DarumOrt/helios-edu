import { NextResponse } from "next/server";
import { quizQuestions } from "@/mocks/data";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { answers: Record<string, unknown> };
  const list = quizQuestions[id] ?? quizQuestions["a3"];

  let score = 0;
  for (const q of list) {
    const given = body.answers[q.id];
    if (q.type === "short" && typeof given === "string" && typeof q.correct === "string") {
      if (given.trim().toLowerCase().includes(q.correct.toLowerCase())) score++;
    } else if (given === q.correct) {
      score++;
    }
  }

  return NextResponse.json({
    attemptId: `attempt-${Date.now()}`,
    score,
    max: list.length,
  });
}
