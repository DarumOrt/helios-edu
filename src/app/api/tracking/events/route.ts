import { NextResponse } from "next/server";
import { ingest } from "@/mocks/tracking-store";
import type { TrackingEvent } from "@/shared/lib/tracking/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { events: TrackingEvent[] };
    if (Array.isArray(body.events)) ingest(body.events);
    return NextResponse.json({ ok: true, accepted: body.events?.length ?? 0 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
