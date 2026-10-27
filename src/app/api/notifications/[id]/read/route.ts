import { NextResponse } from "next/server";
import { markRead } from "@/mocks/announcements-store";
import { currentUser } from "@/mocks/current-user";
import { userNotifications } from "@/mocks/notifications";
import { backendForward } from "@/shared/lib/backend";

// Отметить уведомление прочитанным — для каждого пользователя отдельно (объявления курсов).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/notifications/${encodeURIComponent(id)}/read`);
  if (forwarded) return forwarded;
  const user = await currentUser();
  if (user instanceof Response) return user;
  // как в C#: отметить можно только своё уведомление
  const list = await userNotifications(user);
  if (list instanceof Response) return list;
  if (!list.some((n) => n.id === id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  markRead(user.id, id);
  return NextResponse.json({ ok: true });
}
