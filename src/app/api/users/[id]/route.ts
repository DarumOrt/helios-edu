import { audit } from "@/mocks/audit-store";
import { NextResponse } from "next/server";
import { serverOnly, backendForward } from "@/shared/lib/backend";
import { findDemoUser, findDemoUserByEmail, updateDemoUser } from "@/mocks/users-store";
import { findCohortByName } from "@/mocks/cohorts-store";
import { demoActorWith, fail, readJson, str } from "@/mocks/management-guards";
import { assignableRoles, canManageUser, isSelf } from "@/shared/auth/management";
import { validateUser, type UserInput } from "@/shared/lib/management-validation";
import type { Role, UserStatus } from "@/shared/types/domain";

// PATCH { name?, email?, role?, group?: string | null, faculty?: string | null, status? } — изменить пользователя.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/users/${encodeURIComponent(id)}`);
  if (forwarded) return forwarded;

  const actor = await demoActorWith("user.manage");
  if (actor instanceof NextResponse) return actor;
  const target = findDemoUser(id);
  if (!target) return fail(404, "not found");
  if (!canManageUser(actor, target))
    return fail(403, "Учётные записи администраторов меняет только администратор");
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");

  const patch: Partial<UserInput> = {};
  if (body.name !== undefined) patch.name = str(body.name) ?? "";
  if (body.email !== undefined) patch.email = str(body.email) ?? "";
  if (body.role !== undefined) patch.role = body.role as Role;
  if (body.status !== undefined) patch.status = body.status as UserStatus;
  if (body.faculty !== undefined) patch.faculty = str(body.faculty) || null;
  if (body.group !== undefined) patch.group = str(body.group) || null;

  const role = patch.role ?? target.role;
  const fields = validateUser({ ...patch, role }, true);
  if (patch.role && patch.role !== target.role) {
    if (isSelf(actor, target)) fields.role = "Свою роль изменить нельзя";
    else if (!assignableRoles(actor.role).includes(patch.role))
      fields.role = "Эту роль может назначить только администратор";
  }
  if (patch.status === "blocked" && isSelf(actor, target)) fields.status = "Себя заблокировать нельзя";
  if (patch.group && !fields.group && !findCohortByName(patch.group)) fields.group = "Такой группы нет";
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  if (patch.email) {
    const owner = findDemoUserByEmail(patch.email);
    if (owner && owner.id !== id)
      return fail(409, "Эта почта уже зарегистрирована", { email: "Эта почта уже зарегистрирована" });
  }

  // не-студент группы не имеет; при смене роли с «студент» группа снимается
  const group =
    role !== "student" ? undefined : patch.group === undefined ? target.group : (patch.group ?? undefined);
  const user = updateDemoUser(id, {
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.email !== undefined && { email: patch.email }),
    ...(patch.status !== undefined && { status: patch.status }),
    ...(patch.faculty !== undefined && { faculty: patch.faculty ?? undefined }),
    role,
    group: group ? findCohortByName(group)!.name : undefined,
  });
  await audit(
    patch.status === "blocked"
      ? "user.blocked"
      : patch.status === "active"
        ? "user.unblocked"
        : "user.updated",
    `${user!.name} · ${user!.email}`,
  );
  return NextResponse.json(user);
}

// DELETE — удалить пользователя: с данными — обезличить, без данных — полностью. Только сервер.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/users/${encodeURIComponent(id)}`);
  return forwarded ?? serverOnly();
}
