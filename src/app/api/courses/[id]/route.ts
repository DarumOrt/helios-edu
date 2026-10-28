import { audit, diff } from "@/mocks/audit-store";
import { NextResponse } from "next/server";
import { withCover } from "@/mocks/course-cover-store";
import { findDemoCourse, updateDemoCourse } from "@/mocks/course-store";
import { visibleDemoCourses } from "@/mocks/demo-courses";
import { findDemoUser } from "@/mocks/users-store";
import { demoActorWith, fail, readJson, str } from "@/mocks/management-guards";
import { MANAGED_COURSE_FIELDS, canEditCourse } from "@/shared/auth/management";
import { serverOnly, backendForward, backendJson } from "@/shared/lib/backend";
import { validateCourse, type CourseInput } from "@/shared/lib/management-validation";
import type { Course, CourseStatus } from "@/shared/types/domain";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const backend = await backendJson<Course>(`/api/courses/${encodeURIComponent(id)}`);
  if (backend) return backend.ok ? NextResponse.json(backend.data) : backend.response;

  // как в C#: невидимый курс неотличим от несуществующего
  const course = (await visibleDemoCourses()).find((c) => c.id === id);
  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(withCover(course));
}

// PATCH { title?, description?, category?, tutorId?, status?, faculty?, academicYear? } — карточка курса (course.edit).
// Преподаватель правит только свой курс и без полей управления (MANAGED_COURSE_FIELDS).
// Код курса не меняется: на него ссылаются журналы и расписание.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/courses/${encodeURIComponent(id)}`);
  if (forwarded) return forwarded;

  const actor = await demoActorWith("course.edit");
  if (actor instanceof NextResponse) return actor;
  const existing = findDemoCourse(id);
  // как в C#: чужой курс преподавателю не виден
  if (!existing || !canEditCourse(actor, existing)) return fail(404, "not found");
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  if (actor.role === "tutor" && MANAGED_COURSE_FIELDS.some((key) => body[key] !== undefined))
    return fail(403, "Преподавателя, факультет и учебный год курса меняет организатор");

  const patch: Partial<CourseInput> = {};
  for (const key of ["title", "category", "description", "tutorId"] as const)
    if (body[key] !== undefined) patch[key] = str(body[key]) ?? "";
  // пустой факультет или год — «не указан»
  for (const key of ["faculty", "academicYear"] as const)
    if (body[key] !== undefined) patch[key] = str(body[key]) || undefined;
  if (body.status !== undefined) patch.status = body.status as CourseStatus;
  if (body.code !== undefined)
    return fail(400, "Код курса изменить нельзя", { code: "Код курса изменить нельзя" });

  const fields = validateCourse(patch, true);
  if (patch.tutorId && !fields.tutorId && findDemoUser(patch.tutorId)?.role !== "tutor")
    fields.tutorId = "Выберите преподавателя";
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  const course = updateDemoCourse(id, patch)!;
  await audit(
    "course.updated",
    `${course.code} · ${course.title}`,
    diff(
      ["Название", existing.title, course.title],
      ["Статус", existing.status, course.status],
      ["Описание", existing.description, course.description],
    ),
  );
  return NextResponse.json(withCover(course));
}

// DELETE — курс в корзину на 7 дней (оценки пока сохраняются у учеников). Только сервер.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/courses/${encodeURIComponent(id)}`);
  return forwarded ?? serverOnly();
}
