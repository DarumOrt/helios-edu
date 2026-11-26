import { getDemoActor } from "@/mocks/demo-actor";
import { NextResponse } from "next/server";
import { ingest } from "@/mocks/tracking-store";
import { backendForward } from "@/shared/lib/backend";
import type { TrackingEvent } from "@/shared/lib/tracking/types";

// POST { courseId, events } — события просмотра. Сервер — C# («пульс» не хранится), демо — моки.
export async function POST(req: Request) {
  const forwarded = await backendForward(req, "/api/tracking/events");
  if (forwarded) return forwarded;
  if ((await getDemoActor()).role === "admin") return NextResponse.json({ ok: true, accepted: 0 });
  try {
    const body = (await req.json()) as { events: TrackingEvent[]; courseId: string };
    if (Array.isArray(body.events)) ingest(body.events, body.courseId);
    return NextResponse.json({ ok: true, accepted: body.events?.length ?? 0 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
