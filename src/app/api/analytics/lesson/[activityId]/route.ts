import { NextResponse } from "next/server";
import { lessonStats, getActivityEvents } from "@/mocks/tracking-store";

export async function GET(req: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  // детализация по конкретному студенту (таймлайн событий)
  if (userId) {
    return NextResponse.json({
      rows: lessonStats(activityId).filter((r) => r.userId === userId),
      events: getActivityEvents(activityId, userId),
    });
  }

  return NextResponse.json({ rows: lessonStats(activityId) });
}
