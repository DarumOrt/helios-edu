import { NextResponse } from "next/server";
import { listSubmissions } from "@/mocks/submissions-store";
import { backendForward } from "@/shared/lib/backend";
import type { Submission } from "@/shared/types/domain";

// GET ?status= — работы на проверку. Сервер — C#: только курсы, которые видит пользователь (преподавателю — свои).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const forwarded = await backendForward(req, `/api/submissions${url.search}`);
  if (forwarded) return forwarded;
  const status = url.searchParams.get("status") as Submission["status"] | null;
  return NextResponse.json({ items: listSubmissions(status ? { status } : undefined) });
}
