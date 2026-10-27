import { api } from "@/shared/lib/api-client";
import type { AnswerResult, AttemptResult, AttemptStart, HintResult } from "@/shared/types/domain";

// Адаптивное обучение (P5): один контракт для демо-моков и C# API — docs/backend/p5-adaptive.md.
const c = (courseId: string) => encodeURIComponent(courseId);

export const adaptiveKeys = {
  progress: (courseId: string) => `/api/me/courses/${c(courseId)}/progress`,
  next: (courseId: string) => `/api/me/courses/${c(courseId)}/next`,
};

export const adaptiveApi = {
  startAttempt: (courseId: string, activityId: string) =>
    api.post<AttemptStart>(
      `/api/courses/${c(courseId)}/quizzes/${encodeURIComponent(activityId)}/attempts`,
      {},
    ),
  answer: (attemptId: string, questionId: string, given: unknown) =>
    api.post<AnswerResult>(`/api/attempts/${attemptId}/answers`, { questionId, given }),
  hint: (attemptId: string, questionId: string) =>
    api.post<HintResult>(`/api/attempts/${attemptId}/hint`, { questionId }),
  submit: (attemptId: string) => api.post<AttemptResult>(`/api/attempts/${attemptId}/submit`, {}),
  react: (recommendationId: string, status: "accepted" | "skipped") =>
    api.post<void>(`/api/me/recommendations/${recommendationId}`, { status }),
  /** просмотр и завершение видео/PDF — для модели ученика; ошибки не мешают учёбе */
  event: (
    courseId: string,
    type: "activity.viewed" | "activity.completed",
    activityId: string,
    coverage?: number,
  ) =>
    api
      .post<void>(`/api/me/courses/${c(courseId)}/events`, {
        type,
        activityId,
        ...(coverage !== undefined && { coverage }),
      })
      .catch(() => undefined),
};

/** «42%» из вероятности освоения 0..1 */
export const masteryPercent = (p: number) => `${Math.round(p * 100)}%`;
