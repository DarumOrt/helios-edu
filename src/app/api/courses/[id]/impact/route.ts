import { backendForward, serverOnly } from "@/shared/lib/backend";

// Что потеряется с курсом — для подтверждения удаления. Только сервер.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/courses/${encodeURIComponent(id)}/impact`);
  return forwarded ?? serverOnly();
}
