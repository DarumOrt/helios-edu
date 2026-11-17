import { NextResponse } from "next/server";
import { backendForward } from "@/shared/lib/backend";
import { demoActorWith, fail, readJson, str } from "@/mocks/management-guards";
import { findDemoCourse } from "@/mocks/course-store";
import { findDemoUser } from "@/mocks/users-store";
import { enrollStudent, isEnrolled, matchesKeyword, selfEnrollmentEnabled } from "@/mocks/enrollment-store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/courses/${encodeURIComponent(id)}/enroll`);
  if (forwarded) return forwarded;
  const actor = await demoActorWith("course.enroll");
  if (actor instanceof Response) return actor;
  const course = findDemoCourse(id);
  if (!course || course.status !== "published" || findDemoUser(course.tutorId)?.tenantId !== actor.tenantId)
    return fail(404, "not found");
  if (isEnrolled(id, actor)) return NextResponse.json({ ok: true });
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  if (!selfEnrollmentEnabled(id)) return fail(403, "Самостоятельная запись на курс отключена");
  const keyword = str(body.keyword) ?? "";
  if (keyword.length < 4 || keyword.length > 64 || !matchesKeyword(id, keyword))
    return fail(400, "Проверьте поля формы", { keyword: "Неверное кодовое слово" });
  enrollStudent(id, actor.id, "self");
  return NextResponse.json({ ok: true });
}
