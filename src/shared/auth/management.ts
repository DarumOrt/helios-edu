import { can } from "./permissions";
import type { Course, Role, User } from "@/shared/types/domain";

// Правила управления пользователями. Одни для интерфейса, моков Next и C# API
// (см. docs/backend/p1-management.md) — меняются вместе.

const ALL_ROLES: Role[] = ["student", "tutor", "organizer", "admin"];

/** Организатор назначает студента и преподавателя. */
export function assignableRoles(actorRole: Role): Role[] {
  if (actorRole === "admin") return ALL_ROLES;
  if (actorRole === "organizer") return ["student", "tutor"];
  return [];
}

/** Организатор управляет заявками, студентами и преподавателями, а также своей учётной записью. */
export function canManageUser(
  actor: { id?: string; role: Role },
  target: { id?: string; role?: Role },
): boolean {
  if (!can(actor.role, "user.manage")) return false;
  return (
    actor.role === "admin" ||
    (target.role !== "admin" &&
      (target.role !== "organizer" || (actor.id !== undefined && actor.id === target.id)))
  );
}

/** Себе нельзя менять роль и блокировать себя — иначе легко потерять доступ к управлению. */
export function isSelf(actor: Pick<User, "id">, target: Pick<User, "id">): boolean {
  return actor.id === target.id;
}

/** Поля карточки курса, которые меняет только управление (C#: CourseEndpoints.ManagedCourseFields). */
export const MANAGED_COURSE_FIELDS = ["tutorId", "faculty", "academicYear"] as const;

/** Область организатора определяется факультетом курса, область преподавателя — его назначением. */
export function canEditCourse(
  actor: Pick<User, "id" | "role" | "organizerFaculties">,
  course: Pick<Course, "tutorId" | "faculty">,
): boolean {
  if (!can(actor.role, "course.edit")) return false;
  if (actor.role === "organizer" && actor.organizerFaculties)
    return actor.organizerFaculties.includes(course.faculty ?? "");
  return actor.role !== "tutor" || course.tutorId === actor.id;
}
