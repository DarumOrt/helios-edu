import { NextResponse } from "next/server";
import { markRead } from "@/mocks/announcements-store";
import { currentUser } from "@/mocks/current-user";
import { backendForward } from "@/shared/lib/backend";

// Отметить уведомление прочитанным — для каждого пользователя отдельно (объявления курсов).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/notifications/${encodeURIComponent(id)}/read`);
  if (forwarded) return forwarded;
  const user = await currentUser();
  if (user instanceof Response) return user;
  markRead(user.id, id);
  return NextResponse.json({ ok: true });
}
