import { audit, auditIfOk } from "@/mocks/audit-store";
import { NextResponse } from "next/server";
import { backendForward, isNotImplemented } from "@/shared/lib/backend";
import { createCohort, findCohortByName, listCohorts } from "@/mocks/cohorts-store";
import { demoActorWith, fail, readJson, str } from "@/mocks/management-guards";
import { validateCohort } from "@/shared/lib/management-validation";

export async function GET(req: Request) {
  const forwarded = await backendForward(req, "/api/cohorts");
  // Переходный период: пока групп нет в C#, список читается из моков (права уже проверил proxy.ts)
  if (forwarded && !(await isNotImplemented(forwarded))) return forwarded;
  return NextResponse.json(listCohorts());
}

// POST { name, faculty? } — создать группу (cohort.manage)
export async function POST(req: Request) {
  const forwarded = await backendForward(req, "/api/cohorts");
  if (forwarded) return auditIfOk(forwarded, "Создана группа", "через сервер");

  const actor = await demoActorWith("cohort.manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const input = { name: str(body.name) ?? "", faculty: str(body.faculty) || undefined };
  const fields = validateCohort(input);
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  if (findCohortByName(input.name))
    return fail(409, "Группа с таким названием уже есть", { name: "Группа с таким названием уже есть" });
  await audit("Создана группа", input.name);
  return NextResponse.json(createCohort(input), { status: 201 });
}
