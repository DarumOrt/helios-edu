import { NextResponse } from "next/server";
import { courses, pairTimes, schedule } from "@/mocks/data";
import { withCover } from "@/mocks/course-cover-store";

// GET ?group=М1227 — пары группы на неделю, с данными курса для отображения.
// Без группы — 400 в обоих режимах (на сервере proxy.ts ещё проверяет, что студент смотрит свою группу).
export async function GET(req: Request) {
  const group = new URL(req.url).searchParams.get("group")?.trim() ?? "";
  if (!group) return NextResponse.json({ error: "Укажите группу" }, { status: 400 });
  const slots = (schedule[group] ?? []).map((s) => {
    const c = courses.find((x) => x.id === s.courseId);
    const course = c ? withCover(c) : undefined;
    return {
      ...s,
      course: course
        ? { id: course.id, code: course.code, title: course.title, coverColor: course.coverColor }
        : null,
    };
  });
  return NextResponse.json({ group, pairs: pairTimes, slots });
}
