import { audit } from "@/mocks/audit-store";
import { NextResponse } from "next/server";
import { backendForward } from "@/shared/lib/backend";
import { findCohort, setCohortMembers } from "@/mocks/cohorts-store";
import { findDemoUser } from "@/mocks/users-store";
import { demoActorWith, fail, readJson } from "@/mocks/management-guards";

// PUT { memberIds } — состав группы целиком. Студент состоит в одной группе: добавленный
// переходит из прежней, убранный остаётся без группы. В группу можно добавить только студента.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/cohorts/${encodeURIComponent(id)}/members`);
  if (forwarded) return forwarded;

  const actor = await demoActorWith("cohort.manage");
  if (actor instanceof NextResponse) return actor;
  if (!findCohort(id)) return fail(404, "not found");
  const body = await readJson(req);
  const ids = body?.memberIds;
  if (!Array.isArray(ids) || ids.some((m) => typeof m !== "string"))
    return fail(400, "Некорректный запрос", { memberIds: "Передайте список id студентов" });
  if ((ids as string[]).some((m) => findDemoUser(m)?.role !== "student"))
    return fail(400, "В группу можно добавить только студентов", {
      memberIds: "В группу можно добавить только студентов",
    });
  const cohort = setCohortMembers(id, ids as string[])!;
  await audit("cohort.members", cohort.name, [
    { field: "Студентов", after: String(cohort.memberIds.length) },
  ]);
  return NextResponse.json(cohort);
}
