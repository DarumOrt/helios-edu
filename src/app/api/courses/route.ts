import { NextResponse } from "next/server";
import { courses } from "@/mocks/data";
import { withCover } from "@/mocks/course-cover-store";
import { backendJson } from "@/shared/lib/backend";
import type { Course } from "@/shared/types/domain";

// По умолчанию — облегчённый список без содержания. ?sections=1 — с модулями и активностями
// (нужно дашборду: «следующий шаг» и сроки сдачи).
export async function GET(req: Request) {
  const withSections = new URL(req.url).searchParams.get("sections") === "1";

  const backend = await backendJson<Course[]>("/api/courses");
  if (backend) {
    if (!backend.ok) return backend.response;
    if (!withSections) return NextResponse.json(backend.data.map(withCover));
    // C# API отдаёт разделы только в карточке курса — собираем их параллельно
    const details = await Promise.all(
      backend.data.map((c) => backendJson<Course>(`/api/courses/${encodeURIComponent(c.id)}`)),
    );
    const full: Course[] = [];
    for (const detail of details) {
      if (!detail) continue;
      if (!detail.ok) return detail.response;
      full.push(withCover(detail.data));
    }
    return NextResponse.json(full);
  }

  if (withSections) return NextResponse.json(courses.map(withCover));
  return NextResponse.json(courses.map(({ sections: _sections, ...rest }) => withCover(rest)));
}
