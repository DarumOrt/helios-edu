import "server-only";
import { NextResponse } from "next/server";
import { getDemoActor } from "@/mocks/demo-actor";
import { can, type Action } from "@/shared/auth/permissions";
import { canEditCourse } from "@/shared/auth/management";
import { findDemoCourse } from "@/mocks/course-store";
import type { Course, User } from "@/shared/types/domain";

// Общие ответы моковых маршрутов управления — в формате C# API: { error, fields? }.
export const fail = (status: number, error: string, fields?: Record<string, string>) =>
  NextResponse.json(fields ? { error, fields } : { error }, { status });

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

/** Демо-актор с нужным правом или ответ 403 */
export async function demoActorWith(action: Action): Promise<User | NextResponse> {
  const actor = await getDemoActor();
  return can(actor.role, action) ? actor : fail(403, "Недостаточно прав");
}

export const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);

/**
 * Демо: оценки и проверка работ курса — как в C# (GradesEndpoints): право у администратора и преподавателя,
 * преподаватель — только своего курса (чужой — 404, как невидимый).
 */
export async function demoCourseReviewer(
  action: "grade.edit" | "submission.review" | "analytics.view",
  courseId: string,
): Promise<{ actor: User; course: Course } | NextResponse> {
  const actor = await getDemoActor();
  if (!can(actor.role, action)) return fail(403, "Недостаточно прав");
  const course = findDemoCourse(courseId);
  if (!course || (actor.role === "tutor" && course.tutorId !== actor.id)) return fail(404, "not found");
  return { actor, course };
}

/** Демо: актор может править содержимое курса. Курс не найден — 404, нет прав — 403 */
export async function demoCourseEditor(
  courseId: string,
): Promise<{ actor: User; course: Course } | NextResponse> {
  const actor = await getDemoActor();
  const course = findDemoCourse(courseId);
  if (!course) return fail(404, "not found");
  if (!canEditCourse(actor, course))
    return fail(403, "Менять содержимое курса может его преподаватель или организатор");
  return { actor, course };
}
