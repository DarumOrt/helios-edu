import { NextResponse } from "next/server";
import { reorderActivities } from "@/mocks/course-store";
import { demoCourseEditor, fail, readJson } from "@/mocks/management-guards";
import { backendForward } from "@/shared/lib/backend";

// PUT { activityIds } — порядок материалов модуля целиком
export async function PUT(req: Request, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  const { id, sectionId } = await params;
  const forwarded = await backendForward(
    req,
    `/api/courses/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}/activities/order`,
  );
  if (forwarded) return forwarded;

  const editor = await demoCourseEditor(id);
  if (editor instanceof NextResponse) return editor;
  const ids = (await readJson(req))?.activityIds;
  const list =
    Array.isArray(ids) && ids.every((x) => typeof x === "string") && reorderActivities(id, sectionId, ids);
  if (!list)
    return fail(400, "Передайте все материалы модуля по одному разу", {
      activityIds: "Неверный порядок материалов",
    });
  return NextResponse.json(list);
}
