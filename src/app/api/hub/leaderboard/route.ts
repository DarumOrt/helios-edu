import { NextResponse } from "next/server";
import { leaderboard } from "@/mocks/tracking-store";
import { backendForward } from "@/shared/lib/backend";

// GET ?courseId= — лидерборд группы по курсу. Сервер — C# (текущий ученик — из сессии), демо — моки (?userId=).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const forwarded = await backendForward(req, `/api/hub/leaderboard${url.search}`);
  if (forwarded) return forwarded;
  const courseId = url.searchParams.get("courseId") ?? "c-dor-ai";
  const userId = url.searchParams.get("userId") ?? undefined;
  return NextResponse.json({ courseId, entries: leaderboard(courseId, userId) });
}
