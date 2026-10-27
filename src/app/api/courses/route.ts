import { audit, auditIfOk } from "@/mocks/audit-store";
import { NextResponse } from "next/server";
import { withCover } from "@/mocks/course-cover-store";
import { createDemoCourse, findDemoCourseByCode } from "@/mocks/course-store";
import { visibleDemoCourses } from "@/mocks/demo-courses";
import { findDemoUser } from "@/mocks/users-store";
import { demoActorWith, fail, readJson, str } from "@/mocks/management-guards";
import { backendForward, backendJson } from "@/shared/lib/backend";
import { validateCourse } from "@/shared/lib/management-validation";
import type { Course } from "@/shared/types/domain";

// По умолчанию — облегчённый список без содержания. ?sections=1 — с модулями и активностями
// (нужно дашборду: «следующий шаг» и сроки сдачи).
export async function GET(req: Request) {
  const withSections = new URL(req.url).searchParams.get("sections") === "1";

  const backend = await backendJson<Course[]>("/api/courses");
  if (backend) {
    if (!backend.ok) return backend.response;
    if (!withSections) return NextResponse.json(backend.data.map(withCover));
    // C# API отдаёт разделы только в карточке курса — собираем их параллельно
    const details = await Promise.all(
      backend.data.map((c) => backendJson<Course>(`/api/courses/${encodeURIComponent(c.id)}`)),
    );
    const full: Course[] = [];
    for (const detail of details) {
      if (!detail) continue;
      if (!detail.ok) return detail.response;
      full.push(withCover(detail.data));
    }
    return NextResponse.json(full);
  }

  const courses = await visibleDemoCourses();
  if (withSections) return NextResponse.json(courses.map(withCover));
  return NextResponse.json(courses.map(({ sections: _sections, ...rest }) => withCover(rest)));
}

// POST { code, title, category, description, tutorId, faculty?, academicYear? } — создать курс (course.create). Новый курс — черновик.
export async function POST(req: Request) {
  const forwarded = await backendForward(req, "/api/courses");
  if (forwarded) return auditIfOk(forwarded, "Создан курс", "через сервер");

  const actor = await demoActorWith("course.create");
  if (actor instanceof NextResponse) return actor;
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const input = {
    code: (str(body.code) ?? "").toUpperCase(),
    title: str(body.title) ?? "",
    category: str(body.category) ?? "",
    description: str(body.description) ?? "",
    tutorId: str(body.tutorId) ?? "",
    faculty: str(body.faculty) || undefined,
    academicYear: str(body.academicYear) || undefined,
  };
  const fields = validateCourse(input);
  if (!fields.tutorId && findDemoUser(input.tutorId)?.role !== "tutor")
    fields.tutorId = "Выберите преподавателя";
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  if (findDemoCourseByCode(input.code))
    return fail(409, "Курс с таким кодом уже есть", { code: "Курс с таким кодом уже есть" });
  await audit("Создан курс", `${input.code} · ${input.title}`);
  return NextResponse.json(createDemoCourse(input), { status: 201 });
}
