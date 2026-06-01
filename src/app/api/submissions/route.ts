import { NextResponse } from "next/server";
import { listSubmissions } from "@/mocks/submissions-store";
import type { Submission } from "@/shared/types/domain";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as Submission["status"] | null;
  return NextResponse.json({
    items: listSubmissions(status ? { status } : undefined),
  });
}
