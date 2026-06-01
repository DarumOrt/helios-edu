import { NextResponse } from "next/server";
import { quizQuestions } from "@/mocks/data";
import { upsert, activityCourse } from "@/mocks/tracking-store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { answers: Record<string, unknown>; userId?: string };
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

  const max = list.length;
  const percent = max > 0 ? Math.round((score / max) * 100) : 0;

  // если тест участвует в метриках курса — записываем результат в store (влияет на лидерборд)
  if (body.userId && activityCourse(id)) {
    upsert({
      sessionId: `quiz-${Date.now()}`,
      userId: body.userId,
      activityId: id,
      activityType: "quiz",
      coverage: percent,
      activeTimeSec: 0,
      completed: true,
      ts: Date.now(),
    });
  }

  return NextResponse.json({ attemptId: `attempt-${Date.now()}`, score, max });
}
