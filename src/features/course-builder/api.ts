import { mutate } from "swr";
import { api } from "@/shared/lib/api-client";
import type { ActivityInput } from "@/shared/lib/content-validation";
import type { Activity, Announcement, QuizQuestion, Section } from "@/shared/types/domain";

// Конструктор курса. Модули и материалы — контракт C# API (docs/backend/p2-course-builder.md);
// вопросы тестов и объявления пока в моках Next в обоих режимах.
const c = (courseId: string) => `/api/courses/${encodeURIComponent(courseId)}`;

export type ActivityPayload = Partial<ActivityInput> & { sectionId?: string };

export const builderApi = {
  addSection: (courseId: string, title: string) => api.post<Section>(`${c(courseId)}/sections`, { title }),
  renameSection: (courseId: string, sectionId: string, title: string) =>
    api.patch<Section>(`${c(courseId)}/sections/${sectionId}`, { title }),
  deleteSection: (courseId: string, sectionId: string) =>
    api.del<void>(`${c(courseId)}/sections/${sectionId}`),
  orderSections: (courseId: string, sectionIds: string[]) =>
    api.put<Section[]>(`${c(courseId)}/sections/order`, { sectionIds }),
  addActivity: (courseId: string, sectionId: string, p: ActivityPayload) =>
    api.post<Activity>(`${c(courseId)}/sections/${sectionId}/activities`, p),
  updateActivity: (courseId: string, activityId: string, p: ActivityPayload) =>
    api.patch<Activity>(`${c(courseId)}/activities/${activityId}`, p),
  deleteActivity: (courseId: string, activityId: string) =>
    api.del<void>(`${c(courseId)}/activities/${activityId}`),
  orderActivities: (courseId: string, sectionId: string, activityIds: string[]) =>
    api.put<Activity[]>(`${c(courseId)}/sections/${sectionId}/activities/order`, { activityIds }),
  saveQuestions: (courseId: string, activityId: string, questions: QuizQuestion[]) =>
    api.put<QuizQuestion[]>(`${c(courseId)}/quizzes/${activityId}/questions`, { questions }),
  announce: (courseId: string, title: string, body: string) =>
    api.post<Announcement>(`${c(courseId)}/announcements`, { title, body }),
};

/** После правок обновляем курс, списки курсов (дашборд берёт ?sections=1) и уведомления */
export function refreshCourse(courseId: string) {
  return mutate(
    (key) =>
      typeof key === "string" &&
      (key.startsWith(c(courseId)) ||
        key.startsWith("/api/courses?") ||
        key === "/api/courses" ||
        key === "/api/notifications"),
  );
}
