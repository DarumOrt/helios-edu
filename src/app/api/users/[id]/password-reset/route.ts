import { backendForward, serverOnly } from "@/shared/lib/backend";

// Сброс пароля: новый временный пароль показывается один раз. Только сервер (в демо паролей нет).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/users/${encodeURIComponent(id)}/password-reset`);
  return forwarded ?? serverOnly();
}
