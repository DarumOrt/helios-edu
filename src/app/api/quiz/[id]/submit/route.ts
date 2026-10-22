import { NextResponse } from "next/server";
import { getQuestions, scoreAnswers } from "@/mocks/quiz-store";
import { upsert, activityCourse } from "@/mocks/tracking-store";

// POST { courseId, answers, userId } — проверка теста. userId сверяет proxy.ts с сессией (сервер).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as {
    courseId?: string;
    answers?: Record<string, unknown>;
    userId?: string;
  };
  if (!body.courseId || !body.answers || typeof body.answers !== "object")
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });

  const list = getQuestions(body.courseId, id);
  if (!list.length) return NextResponse.json({ error: "В тесте пока нет вопросов" }, { status: 409 });
  const { score, max } = scoreAnswers(list, body.answers);
  const percent = max > 0 ? Math.round((score / max) * 100) : 0;

  // если тест участвует в метриках курса — записываем результат (влияет на лидерборд)
  if (body.userId && activityCourse(id, body.courseId)) {
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
