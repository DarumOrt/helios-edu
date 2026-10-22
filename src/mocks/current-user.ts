import "server-only";
import { getDemoActor } from "@/mocks/demo-actor";
import { visibleDemoCourses } from "@/mocks/demo-courses";
import { backendJson } from "@/shared/lib/backend";
import type { Course, User } from "@/shared/types/domain";

// Кто запрашивает и какие курсы ему видны — для моковых разделов, которым нужен пользователь
// (уведомления, объявления). Сервер: сессия и курсы из C#; демо: демо-актор и правила C#.
export async function currentUser(): Promise<User | Response> {
  const backend = await backendJson<User>("/api/auth/me");
  if (backend) return backend.ok ? backend.data : backend.response;
  return getDemoActor();
}

export async function visibleCourses(): Promise<Course[] | Response> {
  const backend = await backendJson<Course[]>("/api/courses");
  if (backend) return backend.ok ? backend.data : backend.response;
  return visibleDemoCourses();
}
