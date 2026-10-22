import { NextResponse } from "next/server";
import { backendForward, backendGet } from "@/shared/lib/backend";
import { allDemoUsers, createDemoUser, findDemoUserByEmail } from "@/mocks/users-store";
import { findCohortByName } from "@/mocks/cohorts-store";
import { demoActorWith, fail, readJson, str } from "@/mocks/management-guards";
import { assignableRoles } from "@/shared/auth/management";
import { validateUser } from "@/shared/lib/management-validation";
import type { Role } from "@/shared/types/domain";

// GET ?group=М1217 — только участники группы
export async function GET(req: Request) {
  const group = new URL(req.url).searchParams.get("group");
  const response = await backendGet(
    group ? `/api/users/classmates?group=${encodeURIComponent(group)}` : "/api/users",
  );
  if (response) return response;
  const users = allDemoUsers();
  return NextResponse.json(group ? users.filter((u) => u.group === group) : users);
}

// POST { name, email, role, group?, faculty? } — создать пользователя (user.manage).
// Сервер отвечает { user, temporaryPassword }, демо — { user } (пароли в демо не нужны).
export async function POST(req: Request) {
  const forwarded = await backendForward(req, "/api/users");
  if (forwarded) return forwarded;

  const actor = await demoActorWith("user.manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");

  const input = {
    name: str(body.name) ?? "",
    email: str(body.email) ?? "",
    role: body.role as Role,
    group: str(body.group) || undefined,
    faculty: str(body.faculty) || undefined,
  };
  const fields = validateUser(input);
  if (!fields.role && !assignableRoles(actor.role).includes(input.role))
    fields.role = "Эту роль может назначить только администратор";
  if (input.group && !fields.group && !findCohortByName(input.group)) fields.group = "Такой группы нет";
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  if (findDemoUserByEmail(input.email))
    return fail(409, "Эта почта уже зарегистрирована", { email: "Эта почта уже зарегистрирована" });

  const user = createDemoUser({
    ...input,
    group: input.group ? findCohortByName(input.group)!.name : undefined,
    status: "active",
  });
  return NextResponse.json({ user }, { status: 201 });
}
