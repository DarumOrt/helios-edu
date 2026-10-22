import { NextResponse } from "next/server";
import { listSubmissions } from "@/mocks/submissions-store";
import { backendJson } from "@/shared/lib/backend";
import type { Course, Submission } from "@/shared/types/domain";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as Submission["status"] | null;
  let items = listSubmissions(status ? { status } : undefined);

  // Сервер: только работы по курсам, которые видит пользователь (преподавателю — свои)
  const visible = await backendJson<Pick<Course, "id">[]>("/api/courses");
  if (visible && !visible.ok) return visible.response;
  if (visible) {
    const ids = new Set(visible.data.map((c) => c.id));
    items = items.filter((s) => ids.has(s.courseId));
  }
  return NextResponse.json({ items });
}
