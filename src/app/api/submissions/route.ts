import { NextResponse } from "next/server";
import { listSubmissions } from "@/mocks/submissions-store";
import { backendForward } from "@/shared/lib/backend";
import type { Submission } from "@/shared/types/domain";
import { getDemoActor } from "@/mocks/demo-actor";
import { findDemoCourse } from "@/mocks/course-store";
import { can } from "@/shared/auth/permissions";

// GET ?status=&courseId= — работы на проверку. Сервер — C#: только курсы, которые видит пользователь (преподавателю — свои).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const forwarded = await backendForward(req, `/api/submissions${url.search}`);
  if (forwarded) return forwarded;
  const actor = await getDemoActor();
  if (!can(actor.role, "submission.review"))
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  const status = url.searchParams.get("status") as Submission["status"] | null;
  const courseId = url.searchParams.get("courseId");
  const items = listSubmissions({ ...(status && { status }), ...(courseId && { courseId }) }).filter(
    (s) => actor.role !== "tutor" || findDemoCourse(s.courseId)?.tutorId === actor.id,
  );
  return NextResponse.json({ items });
}
