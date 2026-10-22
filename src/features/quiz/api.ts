import { api } from "@/shared/lib/api-client";
import type { QuizQuestion } from "@/shared/types/domain";

interface SubmitResult {
  attemptId: string;
  score: number;
  max: number;
}

export const quizApi = {
  // id материалов уникальны только внутри курса — курс передаём всегда
  questions: (courseId: string, quizId: string) =>
    api.get<QuizQuestion[]>(`/api/quiz/${quizId}/questions?courseId=${encodeURIComponent(courseId)}`),
  submit: (courseId: string, quizId: string, answers: Record<string, unknown>, userId: string) =>
    api.post<SubmitResult>(`/api/quiz/${quizId}/submit`, { courseId, answers, userId }),
};
