import { NextResponse } from "next/server";
import { deleteSection, renameSection } from "@/mocks/course-store";
import { demoCourseEditor, fail, readJson, str } from "@/mocks/management-guards";
import { backendForward } from "@/shared/lib/backend";
import { validateSection } from "@/shared/lib/content-validation";

type Ctx = { params: Promise<{ id: string; sectionId: string }> };
const path = (id: string, sectionId: string) =>
  `/api/courses/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}`;

// PATCH { title } — переименовать модуль
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, sectionId } = await params;
  const forwarded = await backendForward(req, path(id, sectionId));
  if (forwarded) return forwarded;

  const editor = await demoCourseEditor(id);
  if (editor instanceof NextResponse) return editor;
  const title = str((await readJson(req))?.title) ?? "";
  const fields = validateSection({ title });
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  const section = renameSection(id, sectionId, title);
  return section ? NextResponse.json(section) : fail(404, "not found");
}

// DELETE — только пустой модуль: материалы сначала удаляют или переносят
export async function DELETE(req: Request, { params }: Ctx) {
  const { id, sectionId } = await params;
  const forwarded = await backendForward(req, path(id, sectionId));
  if (forwarded) return forwarded;

  const editor = await demoCourseEditor(id);
  if (editor instanceof NextResponse) return editor;
  const result = deleteSection(id, sectionId);
  if (result === "missing") return fail(404, "not found");
  if (result === "not-empty") return fail(409, "В модуле есть материалы — сначала удалите или перенесите их");
  return new NextResponse(null, { status: 204 });
}
