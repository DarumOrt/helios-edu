import { mutate } from "swr";
import { api } from "@/shared/lib/api-client";
import type {
  Cohort,
  Course,
  CourseStatus,
  Role,
  User,
  UserStatus,
  PasswordResetResult,
} from "@/shared/types/domain";

// Контракт управления — один для моков Next и C# API (docs/backend/p1-management.md).
export interface UserPayload {
  name?: string;
  email?: string;
  role?: Role;
  group?: string | null;
  faculty?: string | null;
  status?: UserStatus;
}

export interface CoursePayload {
  code?: string;
  title?: string;
  category?: string;
  description?: string;
  tutorId?: string;
  status?: CourseStatus;
  faculty?: string;
  academicYear?: string;
}

export const adminApi = {
  /** сервер возвращает временный пароль один раз; в демо его нет */
  createUser: (p: UserPayload) => api.post<{ user: User; temporaryPassword?: string }>("/api/users", p),
  /** новый временный пароль (показывается один раз), сессии пользователя закрываются */
  resetPassword: (id: string) => api.post<PasswordResetResult>(`/api/users/${id}/password-reset`, {}),
  /** с данными — обезличить, без данных — удалить полностью */
  deleteUser: (id: string) => api.del<void>(`/api/users/${id}`),
  updateUser: (id: string, p: UserPayload) => api.patch<User>(`/api/users/${id}`, p),
  createCohort: (p: { name: string; faculty?: string }) => api.post<Cohort>("/api/cohorts", p),
  updateCohort: (id: string, p: { name?: string; faculty?: string | null; courseIds?: string[] }) =>
    api.patch<Cohort>(`/api/cohorts/${id}`, p),
  setMembers: (id: string, memberIds: string[]) =>
    api.put<Cohort>(`/api/cohorts/${id}/members`, { memberIds }),
  deleteCohort: (id: string) => api.del<void>(`/api/cohorts/${id}`),
  createCourse: (p: CoursePayload) => api.post<Course>("/api/courses", p),
  updateCourse: (id: string, p: CoursePayload) => api.patch<Course>(`/api/courses/${id}`, p),
};

/** После изменений обновляем все списки, где могли отразиться пользователи, группы и курсы */
export function refreshManagement() {
  return mutate(
    (key) =>
      typeof key === "string" &&
      (key.startsWith("/api/users") || key.startsWith("/api/cohorts") || key.startsWith("/api/courses")),
  );
}
