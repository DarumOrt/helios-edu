import { can } from "./permissions";
import type { Course, Role, User } from "@/shared/types/domain";

// Правила управления пользователями. Одни для интерфейса, моков Next и C# API
// (см. docs/backend/p1-management.md) — меняются вместе.

const ALL_ROLES: Role[] = ["student", "tutor", "organizer", "admin"];

/** Какие роли актор может назначать: организатор — всё, кроме администратора. */
export function assignableRoles(actorRole: Role): Role[] {
  if (actorRole === "admin") return ALL_ROLES;
  if (actorRole === "organizer") return ["student", "tutor", "organizer"];
  return [];
}

/** Можно ли актору менять эту учётную запись: организатор не трогает администраторов. */
export function canManageUser(actor: Pick<User, "role">, target: Pick<User, "role">): boolean {
  if (!can(actor.role, "user.manage")) return false;
  return target.role !== "admin" || actor.role === "admin";
}

/** Себе нельзя менять роль и блокировать себя — иначе легко потерять доступ к управлению. */
export function isSelf(actor: Pick<User, "id">, target: Pick<User, "id">): boolean {
  return actor.id === target.id;
}

/** Поля карточки курса, которые меняет только управление (C#: CourseEndpoints.ManagedCourseFields). */
export const MANAGED_COURSE_FIELDS = ["tutorId", "faculty", "academicYear"] as const;

/** Содержимое и карточка курса: администратор и организатор — любой курс, преподаватель — только свой. */
export function canEditCourse(actor: Pick<User, "id" | "role">, course: Pick<Course, "tutorId">): boolean {
  if (!can(actor.role, "course.edit")) return false;
  return actor.role !== "tutor" || course.tutorId === actor.id;
}
