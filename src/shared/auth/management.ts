import { can } from "./permissions";
import type { Role, User } from "@/shared/types/domain";

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
