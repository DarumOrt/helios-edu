import { NextResponse } from "next/server";
import { findActivity } from "@/mocks/course-store";
import { getQuestions, setQuestions } from "@/mocks/quiz-store";
import { demoCourseEditor, fail, readJson } from "@/mocks/management-guards";
import { backendJson } from "@/shared/lib/backend";
import { validateQuestions } from "@/shared/lib/content-validation";
import type { Activity, Course, QuizQuestion } from "@/shared/types/domain";

// Вопросы теста для редактора — с правильными ответами. Хранятся в моках Next в обоих режимах
// (как журнал и работы); в серверном режиме курс и право course.edit проверяет proxy.ts через C#.
type Ctx = { params: Promise<{ id: string; activityId: string }> };

async function quizActivity(courseId: string, activityId: string): Promise<Activity | NextResponse> {
  const backend = await backendJson<Course>(`/api/courses/${encodeURIComponent(courseId)}`);
  let activity: Activity | undefined;
  if (backend) {
    if (!backend.ok) return backend.response as NextResponse;
    activity = backend.data.sections?.flatMap((s) => s.activities).find((a) => a.id === activityId);
  } else {
    const editor = await demoCourseEditor(courseId);
    if (editor instanceof NextResponse) return editor;
    activity = findActivity(courseId, activityId)?.activity;
  }
  if (!activity) return fail(404, "not found");
  return activity.type === "quiz" ? activity : fail(400, "Вопросы есть только у теста");
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id, activityId } = await params;
  const quiz = await quizActivity(id, activityId);
  if (quiz instanceof NextResponse) return quiz;
  return NextResponse.json(getQuestions(id, activityId));
}

// PUT { questions } — вопросы теста целиком
export async function PUT(req: Request, { params }: Ctx) {
  const { id, activityId } = await params;
  const quiz = await quizActivity(id, activityId);
  if (quiz instanceof NextResponse) return quiz;
  const questions = (await readJson(req))?.questions;
  const fields = validateQuestions(questions);
  if (Object.keys(fields).length) return fail(400, fields.questions, fields);
  const clean = (questions as QuizQuestion[]).map((q) => ({
    id: typeof q.id === "string" ? q.id : "",
    type: q.type,
    text: q.text.trim(),
    ...(q.type === "mcq" && { options: q.options!.map((o) => o.trim()) }),
    correct: typeof q.correct === "string" ? q.correct.trim() : q.correct,
  }));
  return NextResponse.json(setQuestions(id, activityId, clean));
}
