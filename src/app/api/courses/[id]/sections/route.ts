import { NextResponse } from "next/server";
import { addSection } from "@/mocks/course-store";
import { demoCourseEditor, fail, readJson, str } from "@/mocks/management-guards";
import { backendForward } from "@/shared/lib/backend";
import { validateSection } from "@/shared/lib/content-validation";

// POST { title } — добавить модуль в конец курса
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/courses/${encodeURIComponent(id)}/sections`);
  if (forwarded) return forwarded;

  const editor = await demoCourseEditor(id);
  if (editor instanceof NextResponse) return editor;
  const body = await readJson(req);
  const title = str(body?.title) ?? "";
  const fields = validateSection({ title });
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  return NextResponse.json(addSection(id, title), { status: 201 });
}
