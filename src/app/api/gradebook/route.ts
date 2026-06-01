import { NextResponse } from "next/server";
import { getCourseGrades } from "@/mocks/gradebook-store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });
  return NextResponse.json(getCourseGrades(courseId));
}
