import { NextResponse } from "next/server";
import { courses } from "@/mocks/data";
import { backendGet } from "@/shared/lib/backend";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await backendGet(`/api/courses/${encodeURIComponent(id)}`);
  if (response) return response;
  const course = courses.find((c) => c.id === id);
  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(course);
}
