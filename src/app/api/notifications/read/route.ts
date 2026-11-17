import { NextResponse } from "next/server";
import { backendForward } from "@/shared/lib/backend";
import { currentUser } from "@/mocks/current-user";
import { userNotifications } from "@/mocks/notifications";
import { markRead } from "@/mocks/announcements-store";
import { fail, readJson } from "@/mocks/management-guards";

export async function POST(req: Request) {
  const forwarded = await backendForward(req, "/api/notifications/read");
  if (forwarded) return forwarded;
  const user = await currentUser();
  if (user instanceof Response) return user;
  const body = await readJson(req);
  const ids: unknown = body?.ids;
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 200 ||
    ids.some((id) => typeof id !== "string" || !id.length || id.length > 200)
  )
    return fail(400, "Выберите от 1 до 200 уведомлений");
  const items = await userNotifications(user);
  if (items instanceof Response) return items;
  const visible = new Set(items.map((n) => n.id));
  if (ids.some((id) => !visible.has(id))) return fail(404, "not found");
  for (const id of ids) markRead(user.id, id);
  return NextResponse.json({ ok: true });
}
