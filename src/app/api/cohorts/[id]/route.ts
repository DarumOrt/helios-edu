import { audit } from "@/mocks/audit-store";
import { NextResponse } from "next/server";
import { backendForward, isNotImplemented } from "@/shared/lib/backend";
import { deleteCohort, findCohort, findCohortByName, updateCohort } from "@/mocks/cohorts-store";
import { findDemoCourse } from "@/mocks/course-store";
import { demoActorWith, fail, readJson, str } from "@/mocks/management-guards";
import { validateCohort } from "@/shared/lib/management-validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/cohorts/${encodeURIComponent(id)}`);
  // переходный период, как у списка групп: пока групп нет в C#, читаем из моков
  if (forwarded && !(await isNotImplemented(forwarded))) return forwarded;
  const cohort = findCohort(id);
  return cohort ? NextResponse.json(cohort) : fail(404, "not found");
}

// PATCH { name?, faculty?, courseIds? } — переименовать группу или задать её курсы
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/cohorts/${encodeURIComponent(id)}`);
  if (forwarded) return forwarded;

  const actor = await demoActorWith("cohort.manage");
  if (actor instanceof NextResponse) return actor;
  if (!findCohort(id)) return fail(404, "not found");
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");

  const patch: { name?: string; faculty?: string | null; courseIds?: string[] } = {};
  if (body.name !== undefined) patch.name = str(body.name) ?? "";
  if (body.faculty !== undefined) patch.faculty = str(body.faculty) || null;
  const fields = validateCohort(patch, true);
  if (body.courseIds !== undefined) {
    const ids = body.courseIds;
    if (!Array.isArray(ids) || ids.some((c) => typeof c !== "string" || !findDemoCourse(c)))
      fields.courseIds = "Есть неизвестные курсы";
    else patch.courseIds = ids as string[];
  }
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  const sameName = patch.name ? findCohortByName(patch.name) : undefined;
  if (sameName && sameName.id !== id)
    return fail(409, "Группа с таким названием уже есть", { name: "Группа с таким названием уже есть" });
  const cohort = updateCohort(id, patch)!;
  await audit("cohort.updated", cohort.name);
  return NextResponse.json(cohort);
}

// DELETE — только пустую группу: студентов сначала переводят или убирают
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/cohorts/${encodeURIComponent(id)}`);
  if (forwarded) return forwarded;

  const actor = await demoActorWith("cohort.manage");
  if (actor instanceof NextResponse) return actor;
  const cohort = findCohort(id);
  if (!cohort) return fail(404, "not found");
  if (cohort.memberIds.length) return fail(409, "В группе есть студенты — сначала уберите их из группы");
  deleteCohort(id);
  await audit("cohort.deleted", cohort.name);
  return new NextResponse(null, { status: 204 });
}
