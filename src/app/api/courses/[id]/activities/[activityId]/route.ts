import { NextResponse } from "next/server";
import { deleteActivity, findActivity, updateActivity } from "@/mocks/course-store";
import { hasSubmissions } from "@/mocks/submissions-store";
import { demoCourseEditor, fail, readJson } from "@/mocks/management-guards";
import { backendForward, getDataSource } from "@/shared/lib/backend";
import { pickActivityFields, validateActivity } from "@/shared/lib/content-validation";
import type { BuilderActivityType } from "@/shared/types/domain";

type Ctx = { params: Promise<{ id: string; activityId: string }> };
const path = (id: string, activityId: string) =>
  `/api/courses/${encodeURIComponent(id)}/activities/${encodeURIComponent(activityId)}`;

// PATCH { title?, due?: string|null, …поля типа, sectionId? } — тип материала не меняется
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, activityId } = await params;
  const forwarded = await backendForward(req, path(id, activityId));
  if (forwarded) return forwarded;

  const editor = await demoCourseEditor(id);
  if (editor instanceof NextResponse) return editor;
  const found = findActivity(id, activityId);
  if (!found) return fail(404, "not found");
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  if (body.type !== undefined && body.type !== found.activity.type)
    return fail(400, "Тип материала изменить нельзя", { type: "Тип материала изменить нельзя" });

  const patch = pickActivityFields(found.activity.type as BuilderActivityType, body, true);
  const fields = validateActivity(patch, true);
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  const result = updateActivity(id, activityId, {
    ...patch,
    ...(typeof patch.due === "string" && { due: new Date(patch.due).toISOString() }),
    ...(typeof body.sectionId === "string" && { sectionId: body.sectionId }),
  });
  if (result === "missing") return fail(404, "not found");
  if (result === "no-section") return fail(400, "Такого модуля нет", { sectionId: "Такого модуля нет" });
  return NextResponse.json(result);
}

// DELETE — задание со сданными работами не удаляется: пропали бы оценки.
// Работы пока хранятся в Next, поэтому это правило проверяем здесь и в серверном режиме.
export async function DELETE(req: Request, { params }: Ctx) {
  const { id, activityId } = await params;
  const demo = (await getDataSource()).source === "demo";
  // сначала права (в сервере их уже проверил proxy.ts), потом — есть ли работы
  if (demo) {
    const editor = await demoCourseEditor(id);
    if (editor instanceof NextResponse) return editor;
    if (!findActivity(id, activityId)) return fail(404, "not found");
  }
  if (hasSubmissions(id, activityId))
    return fail(409, "По заданию уже есть сданные работы — удалить его нельзя, чтобы не потерять оценки");
  const forwarded = await backendForward(req, path(id, activityId));
  if (forwarded) return forwarded;
  deleteActivity(id, activityId);
  return new NextResponse(null, { status: 204 });
}
