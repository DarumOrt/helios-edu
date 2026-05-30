import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  return NextResponse.json({
    ok: true,
    submissionId: `sub-${id}-${Date.now()}`,
    received: body,
  });
}
