import { NextResponse } from "next/server";
import { reorderSections } from "@/mocks/course-store";
import { demoCourseEditor, fail, readJson } from "@/mocks/management-guards";
import { backendForward } from "@/shared/lib/backend";

// PUT { sectionIds } — порядок модулей целиком (все модули курса, каждый один раз)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/courses/${encodeURIComponent(id)}/sections/order`);
  if (forwarded) return forwarded;

  const editor = await demoCourseEditor(id);
  if (editor instanceof NextResponse) return editor;
  const ids = (await readJson(req))?.sectionIds;
  const sections = Array.isArray(ids) && ids.every((x) => typeof x === "string") && reorderSections(id, ids);
  if (!sections)
    return fail(400, "Передайте все модули курса по одному разу", { sectionIds: "Неверный порядок модулей" });
  return NextResponse.json(sections);
}
