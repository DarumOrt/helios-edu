import { backendForward } from "@/shared/lib/backend";
import { demoCourseEditor, fail } from "@/mocks/management-guards";
import { listAnnouncements, removeAnnouncement } from "@/mocks/announcements-store";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; announcementId: string }> },
) {
  const { id, announcementId } = await params;
  const forwarded = await backendForward(
    req,
    `/api/courses/${encodeURIComponent(id)}/announcements/${encodeURIComponent(announcementId)}`,
  );
  if (forwarded) return forwarded;
  const editor = await demoCourseEditor(id);
  if (editor instanceof Response) return editor;
  const item = listAnnouncements([id], editor.actor).find((a) => a.id === announcementId);
  if (!item) return fail(404, "not found");
  if (!item.canDelete) return fail(403, "Можно удалить только своё объявление");
  removeAnnouncement(id, announcementId);
  return new Response(null, { status: 204 });
}
