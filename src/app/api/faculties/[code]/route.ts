import { NextResponse } from "next/server";
import { backendForward, isSameOrigin } from "@/shared/lib/backend";
import { demoFaculties } from "@/mocks/faculties-store";
import { demoActorWith, fail, readJson, str } from "@/mocks/management-guards";
import { listDemoCourses } from "@/mocks/course-store";
import { listCohorts } from "@/mocks/cohorts-store";
import { allDemoUsers } from "@/mocks/users-store";
import { audit } from "@/mocks/audit-store";

type Context = { params: Promise<{ code: string }> };
async function change(req: Request, ctx: Context) {
  const { code } = await ctx.params;
  const forwarded = await backendForward(req, "/api/faculties/" + encodeURIComponent(code));
  if (forwarded) return forwarded;
  if (!isSameOrigin(req)) return fail(403, "Недостаточно прав");
  const actor = await demoActorWith("system.manage");
  if (actor instanceof NextResponse) return actor;
  const rows = demoFaculties();
  const faculty = rows.find((f) => f.code === code);
  if (!faculty) return fail(404, "Факультет не найден");
  if (req.method === "DELETE") {
    if ([...listDemoCourses(), ...listCohorts(), ...allDemoUsers()].some((row) => row.faculty === code))
      return fail(409, "Факультет используется. Перенесите записи или отправьте факультет в архив.");
    rows.splice(rows.indexOf(faculty), 1);
    await audit("faculty.deleted", faculty.name);
    return new NextResponse(null, { status: 204 });
  }
  const body = await readJson(req);
  if (!body || Object.keys(body).some((k) => !["archived", "name"].includes(k)))
    return fail(400, "Некорректный запрос");
  const name = "name" in body ? (str(body.name) ?? "") : faculty.name;
  if (name.length < 2 || name.length > 180 || ("archived" in body && typeof body.archived !== "boolean"))
    return fail(400, "Проверьте поля формы");
  faculty.name = name;
  if (typeof body.archived === "boolean") faculty.archived = body.archived;
  await audit("faculty.updated", name);
  return NextResponse.json(faculty);
}
export { change as PATCH, change as DELETE };
