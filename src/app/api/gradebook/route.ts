import { NextResponse } from "next/server";
import { getCourseGrades } from "@/mocks/gradebook-store";
import { backendForward } from "@/shared/lib/backend";

// GET ?courseId= — журнал оценок курса. Сервер — C#: оценки преподавателя и лучшие попытки тестов.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const forwarded = await backendForward(req, `/api/gradebook${url.search}`);
  if (forwarded) return forwarded;
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });
  return NextResponse.json(getCourseGrades(courseId));
}
