import { NextResponse } from "next/server";
import { reviewSubmission } from "@/mocks/submissions-store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { grade: number; feedback: string };
  const updated = reviewSubmission(id, body.grade, body.feedback ?? "");
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(updated);
}
