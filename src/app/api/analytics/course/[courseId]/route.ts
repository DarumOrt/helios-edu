import { NextResponse } from "next/server";
import { courseStats } from "@/mocks/tracking-store";

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return NextResponse.json({ activities: courseStats(courseId) });
}
