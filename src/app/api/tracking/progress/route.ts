import { NextResponse } from "next/server";
import { upsert, getProgress } from "@/mocks/tracking-store";
import type { ProgressSnapshot } from "@/shared/lib/tracking/types";

export async function POST(req: Request) {
  try {
    const snapshot = (await req.json()) as ProgressSnapshot;
    upsert(snapshot);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const activityId = url.searchParams.get("activityId");
  if (!userId || !activityId) {
    return NextResponse.json({ error: "userId and activityId required" }, { status: 400 });
  }
  return NextResponse.json(getProgress(userId, activityId));
}
