import { api } from "@/shared/lib/api-client";
import type { QuizQuestion } from "@/shared/types/domain";

interface SubmitResult {
  attemptId: string;
  score: number;
  max: number;
}

export const quizApi = {
  questions: (quizId: string) => api.get<QuizQuestion[]>(`/api/quiz/${quizId}/questions`),
  submit: (quizId: string, answers: Record<string, unknown>) =>
    api.post<SubmitResult>(`/api/quiz/${quizId}/submit`, { answers }),
};
