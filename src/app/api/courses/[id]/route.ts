import { NextResponse } from "next/server";
import { courses } from "@/mocks/data";
import { withCover } from "@/mocks/course-cover-store";
import { backendJson } from "@/shared/lib/backend";
import type { Course } from "@/shared/types/domain";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const backend = await backendJson<Course>(`/api/courses/${encodeURIComponent(id)}`);
  if (backend) return backend.ok ? NextResponse.json(withCover(backend.data)) : backend.response;

  const course = courses.find((c) => c.id === id);
  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(withCover(course));
}
