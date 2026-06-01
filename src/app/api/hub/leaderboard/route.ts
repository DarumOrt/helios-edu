import { NextResponse } from "next/server";
import { leaderboard } from "@/mocks/tracking-store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId") ?? "c-matan";
  const userId = url.searchParams.get("userId") ?? undefined;
  return NextResponse.json({ courseId, entries: leaderboard(courseId, userId) });
}
