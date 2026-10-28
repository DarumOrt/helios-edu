import { NextResponse } from "next/server";
import { courseStats } from "@/mocks/tracking-store";
import { backendForward } from "@/shared/lib/backend";

// Аналитика курса по материалам. Сервер — C# (ученики групп курса), демо — моки.
export async function GET(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const forwarded = await backendForward(req, `/api/analytics/course/${encodeURIComponent(courseId)}`);
  if (forwarded) return forwarded;
  return NextResponse.json({ activities: courseStats(courseId) });
}
