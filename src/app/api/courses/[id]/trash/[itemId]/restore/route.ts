import { backendForward, serverOnly } from "@/shared/lib/backend";

// Вернуть модуль или материал из корзины курса. Только сервер.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const forwarded = await backendForward(
    req,
    `/api/courses/${encodeURIComponent(id)}/trash/${encodeURIComponent(itemId)}/restore`,
  );
  return forwarded ?? serverOnly();
}
