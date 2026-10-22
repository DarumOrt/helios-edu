import { NextResponse } from "next/server";
import { addActivity } from "@/mocks/course-store";
import { demoCourseEditor, fail, readJson } from "@/mocks/management-guards";
import { backendForward } from "@/shared/lib/backend";
import { pickActivityFields, validateActivity } from "@/shared/lib/content-validation";
import { BUILDER_ACTIVITY_TYPES, type Activity, type BuilderActivityType } from "@/shared/types/domain";

// POST { type, title, …поля типа } — добавить материал в конец модуля
export async function POST(req: Request, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  const { id, sectionId } = await params;
  const forwarded = await backendForward(
    req,
    `/api/courses/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}/activities`,
  );
  if (forwarded) return forwarded;

  const editor = await demoCourseEditor(id);
  if (editor instanceof NextResponse) return editor;
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const type = body.type as BuilderActivityType;
  if (!BUILDER_ACTIVITY_TYPES.includes(type))
    return fail(400, "Проверьте поля формы", { type: "Выберите тип материала" });

  const input = { type, ...pickActivityFields(type, body) };
  const fields = validateActivity(input);
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  // null — «не задано»: в материал не попадает
  const { due, ...rest } = input;
  const values = Object.fromEntries(Object.entries(rest).filter(([, v]) => v != null));
  const activity = addActivity(id, sectionId, {
    ...(values as unknown as Omit<Activity, "id">),
    ...(due && { due: new Date(due).toISOString() }),
  });
  return activity ? NextResponse.json(activity, { status: 201 }) : fail(404, "not found");
}
