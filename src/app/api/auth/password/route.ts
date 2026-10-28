import { backendForward, serverOnly } from "@/shared/lib/backend";

// Смена своего пароля: текущий и новый. Только сервер (в демо вход без пароля).
export async function POST(req: Request) {
  const forwarded = await backendForward(req, "/api/auth/password");
  return forwarded ?? serverOnly();
}
