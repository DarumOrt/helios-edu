import { NextResponse } from "next/server";
import { courses } from "@/mocks/data";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = courses.find((c) => c.id === id);
  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(course);
}
