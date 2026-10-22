import { NextResponse } from "next/server";
import { withCover } from "@/mocks/course-cover-store";
import { findDemoCourse, updateDemoCourse } from "@/mocks/course-store";
import { visibleDemoCourses } from "@/mocks/demo-courses";
import { findDemoUser } from "@/mocks/users-store";
import { demoActorWith, fail, readJson, str } from "@/mocks/management-guards";
import { backendForward, backendJson } from "@/shared/lib/backend";
import { validateCourse, type CourseInput } from "@/shared/lib/management-validation";
import type { Course, CourseStatus } from "@/shared/types/domain";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const backend = await backendJson<Course>(`/api/courses/${encodeURIComponent(id)}`);
  if (backend) return backend.ok ? NextResponse.json(withCover(backend.data)) : backend.response;

  // как в C#: невидимый курс неотличим от несуществующего
  const course = (await visibleDemoCourses()).find((c) => c.id === id);
  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(withCover(course));
}

// PATCH { title?, description?, category?, tutorId?, status? } — карточка курса (course.create).
// Код курса не меняется: на него ссылаются журналы и расписание.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/courses/${encodeURIComponent(id)}`);
  if (forwarded) return forwarded;

  const actor = await demoActorWith("course.create");
  if (actor instanceof NextResponse) return actor;
  if (!findDemoCourse(id)) return fail(404, "not found");
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");

  const patch: Partial<CourseInput> = {};
  for (const key of ["title", "category", "description", "tutorId"] as const)
    if (body[key] !== undefined) patch[key] = str(body[key]) ?? "";
  if (body.status !== undefined) patch.status = body.status as CourseStatus;
  if (body.code !== undefined)
    return fail(400, "Код курса изменить нельзя", { code: "Код курса изменить нельзя" });

  const fields = validateCourse(patch, true);
  if (patch.tutorId && !fields.tutorId && findDemoUser(patch.tutorId)?.role !== "tutor")
    fields.tutorId = "Выберите преподавателя";
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  return NextResponse.json(withCover(updateDemoCourse(id, patch)!));
}
