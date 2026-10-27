import { NextResponse } from "next/server";
import { findOwnSubmission } from "@/mocks/submissions-store";
import { findActivity } from "@/mocks/course-store";
import { visibleDemoCourses } from "@/mocks/demo-courses";
import { getDemoActor } from "@/mocks/demo-actor";
import { backendForward } from "@/shared/lib/backend";
import type { MySubmission } from "@/shared/types/domain";

// GET ?courseId=… — своя работа по заданию: статус, текст, оценка. Сервер — C# (Grades/GradesEndpoints.cs),
// демо — моки; ученик в обоих режимах — тот, кто вошёл.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = new URL(req.url).searchParams.get("courseId") ?? "";
  const forwarded = await backendForward(
    req,
    `/api/assignment/${encodeURIComponent(id)}/submission?courseId=${encodeURIComponent(courseId)}`,
  );
  if (forwarded) return forwarded;
  const actor = await getDemoActor();
  if (actor.role !== "student") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  const visible = (await visibleDemoCourses()).some((c) => c.id === courseId);
  if (!visible || findActivity(courseId, id)?.activity.type !== "assignment")
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const submission = findOwnSubmission(courseId, id, actor.id);
  return NextResponse.json<MySubmission>(submission ? { submission } : {});
}
