import { backendForward, serverOnly } from "@/shared/lib/backend";

// Вернуть курс из корзины. Только сервер.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/courses/${encodeURIComponent(id)}/restore`);
  return forwarded ?? serverOnly();
}
