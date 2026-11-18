import { demoFacultyCodes } from "@/mocks/faculties-store";
import { NextResponse } from "next/server";
import { audit } from "@/mocks/audit-store";
import { findCohortByName } from "@/mocks/cohorts-store";
import { demoActorWith, fail, readJson, str } from "@/mocks/management-guards";
import { approveDemoApplication, takeDemoApplication } from "@/mocks/users-store";
import { assignableRoles } from "@/shared/auth/management";
import { backendForward, isSameOrigin } from "@/shared/lib/backend";
import { validateUser } from "@/shared/lib/management-validation";
import type { Role } from "@/shared/types/domain";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(request, `/api/users/${encodeURIComponent(id)}/application`);
  if (forwarded) return forwarded;
  if (!isSameOrigin(request)) return fail(403, "Недостаточно прав");
  const actor = await demoActorWith("user.manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readJson(request);
  if (!body) return fail(400, "Некорректный запрос");
  if ("organizerFaculties" in body) return fail(501, "Назначение полномочий доступно в режиме «Сервер»");
  const role = (str(body.role) ?? "") as Role;
  const groupName = str(body.group);
  const group = groupName ? findCohortByName(groupName) : undefined;
  const faculty = str(body.faculty);
  const fields = validateUser({ role, group: groupName, faculty }, true);
  if (faculty && !fields.faculty && !demoFacultyCodes().includes(faculty))
    fields.faculty = "Выберите факультет из списка";
  if (!fields.role && !assignableRoles(actor.role).includes(role))
    fields.role = "Эту роль может назначить только администратор";
  if (groupName && !group && !fields.group) fields.group = "Такой группы нет";
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);

  const user = approveDemoApplication(id, { role, group: group?.name, faculty: faculty || group?.faculty });
  if (!user) return fail(409, "Заявка уже обработана или не найдена");
  await audit("user.application_approved", user.email);
  return NextResponse.json(user);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(request, `/api/users/${encodeURIComponent(id)}/application`);
  if (forwarded) return forwarded;
  if (!isSameOrigin(request)) return fail(403, "Недостаточно прав");
  const actor = await demoActorWith("user.manage");
  if (actor instanceof NextResponse) return actor;
  if (!takeDemoApplication(id)) return fail(409, "Заявка уже обработана или не найдена");
  await audit("user.application_rejected", "Заявка на доступ");
  return new NextResponse(null, { status: 204 });
}
