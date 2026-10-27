import { api } from "@/shared/lib/api-client";
import type { AnswerResult, AttemptResult, AttemptStart, HintResult, Skill } from "@/shared/types/domain";

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

export interface SkillPayload {
  title?: string;
  code?: string | null;
  description?: string | null;
  sectionId?: string | null;
  prerequisiteIds?: string[];
}

/** Преподаватель: навыки курса и контроль адаптации */
export const teacherAdaptiveApi = {
  skillsKey: (courseId: string) => `/api/courses/${c(courseId)}/skills`,
  dashboardKey: (courseId: string) => `/api/courses/${c(courseId)}/adaptive`,
  eventsKey: (courseId: string, userId: string) =>
    `/api/courses/${c(courseId)}/events?userId=${encodeURIComponent(userId)}&limit=50`,
  createSkill: (courseId: string, p: SkillPayload) =>
    api.post<Skill>(`/api/courses/${c(courseId)}/skills`, p),
  updateSkill: (courseId: string, skillId: string, p: SkillPayload) =>
    api.patch<Skill>(`/api/courses/${c(courseId)}/skills/${skillId}`, p),
  deleteSkill: (courseId: string, skillId: string) =>
    api.del<void>(`/api/courses/${c(courseId)}/skills/${skillId}`),
  importSkills: (courseId: string, text: string, sectionId: string | null) =>
    api.post<Skill[]>(`/api/courses/${c(courseId)}/skills/import`, { text, sectionId }),
  linkSkills: (courseId: string, activityId: string, skillIds: string[]) =>
    api.put<{ activityId: string; skillIds: string[] }>(
      `/api/courses/${c(courseId)}/activities/${encodeURIComponent(activityId)}/skills`,
      { skillIds },
    ),
  setEnabled: (courseId: string, enabled: boolean) =>
    api.patch<{ enabled: boolean }>(`/api/courses/${c(courseId)}/adaptive`, { enabled }),
  overrideSkill: (
    courseId: string,
    userId: string,
    skillId: string,
    action: "master" | "reset" | "unlock",
    reason: string,
  ) =>
    api.put<unknown>(`/api/courses/${c(courseId)}/adaptive/students/${userId}/skills/${skillId}`, {
      action,
      reason,
    }),
  pin: (courseId: string, userId: string, activityId: string | null, reason: string) =>
    api.put<unknown>(`/api/courses/${c(courseId)}/adaptive/students/${userId}/pin`, { activityId, reason }),
};

/** «42%» из вероятности освоения 0..1 */
export const masteryPercent = (p: number) => `${Math.round(p * 100)}%`;
