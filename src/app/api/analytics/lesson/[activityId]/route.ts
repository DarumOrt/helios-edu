import { NextResponse } from "next/server";
import { lessonStats, getActivityEvents } from "@/mocks/tracking-store";
import { backendForward } from "@/shared/lib/backend";

// GET ?courseId=&userId= — статистика урока по ученикам; с userId — ещё и лента его событий.
// Сервер — C#, демо — моки.
export async function GET(req: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const url = new URL(req.url);
  const forwarded = await backendForward(
    req,
    `/api/analytics/lesson/${encodeURIComponent(activityId)}${url.search}`,
  );
  if (forwarded) return forwarded;
  const courseId = url.searchParams.get("courseId");
  const userId = url.searchParams.get("userId");

  // детализация по конкретному студенту (таймлайн событий)
  if (userId) {
    return NextResponse.json({
      rows: lessonStats(activityId, courseId).filter((r) => r.userId === userId),
      events: getActivityEvents(activityId, courseId, userId),
    });
  }

  return NextResponse.json({ rows: lessonStats(activityId, courseId) });
}
