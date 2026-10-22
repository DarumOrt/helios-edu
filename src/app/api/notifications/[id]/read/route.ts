import { NextResponse } from "next/server";
import { markRead } from "@/mocks/announcements-store";
import { currentUser } from "@/mocks/current-user";

// Отметить уведомление прочитанным — для каждого пользователя отдельно (объявления курсов).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (user instanceof Response) return user;
  markRead(user.id, id);
  return NextResponse.json({ ok: true });
}
