import { NextResponse } from "next/server";
import { currentUser } from "@/mocks/current-user";
import { userNotifications } from "@/mocks/notifications";
import { backendForward } from "@/shared/lib/backend";

// Уведомления: объявления видимых курсов, личные («оценка выставлена») и демонстрационные.
// Сервер — C# (там вместо демонстрационных — близкие сроки сдачи), демо — моки ниже.
export async function GET(req: Request) {
  const forwarded = await backendForward(req, "/api/notifications");
  if (forwarded) return forwarded;
  const user = await currentUser();
  if (user instanceof Response) return user;
  const list = await userNotifications(user);
  return list instanceof Response ? list : NextResponse.json(list);
}
