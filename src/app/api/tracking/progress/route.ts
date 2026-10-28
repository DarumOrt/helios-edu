import { NextResponse } from "next/server";
import { upsert, getProgress } from "@/mocks/tracking-store";
import { backendForward } from "@/shared/lib/backend";
import type { ProgressSnapshot } from "@/shared/lib/tracking/types";

// Прогресс по материалу. Сервер — C# (Tracking/TrackingEndpoints.cs: ученик из сессии, курс обязателен),
// демо — моки ниже.
export async function POST(req: Request) {
  const forwarded = await backendForward(req, "/api/tracking/progress");
  if (forwarded) return forwarded;
  try {
    const snapshot = (await req.json()) as ProgressSnapshot;
    upsert(snapshot);
    return NextResponse.json({ ok: true, accepted: 1 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

// GET ?courseId=&activityId= — свой прогресс (демо: ?userId=)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const forwarded = await backendForward(req, `/api/tracking/progress${url.search}`);
  if (forwarded) return forwarded;
  const userId = url.searchParams.get("userId");
  const activityId = url.searchParams.get("activityId");
  if (!userId || !activityId) {
    return NextResponse.json({ error: "userId and activityId required" }, { status: 400 });
  }
  return NextResponse.json(getProgress(userId, activityId));
}
