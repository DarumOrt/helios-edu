import { NextResponse } from "next/server";
import { notifications } from "@/mocks/data";
import { isRead, listAnnouncements, listPersonal } from "@/mocks/announcements-store";
import { currentUser, visibleCourses } from "@/mocks/current-user";
import type { Notification } from "@/shared/types/domain";
import { backendForward } from "@/shared/lib/backend";

// Уведомления: объявления видимых курсов, личные («оценка выставлена») и демонстрационные.
// Сервер — C# (там вместо демонстрационных — близкие сроки сдачи), демо — моки ниже.
export async function GET(req: Request) {
  const forwarded = await backendForward(req, "/api/notifications");
  if (forwarded) return forwarded;
  const [user, courses] = await Promise.all([currentUser(), visibleCourses()]);
  if (user instanceof Response) return user;
  if (courses instanceof Response) return courses;

  const byId = new Map(courses.map((c) => [c.id, c]));
  const announcements: Notification[] = listAnnouncements(byId.keys()).map((a) => ({
    id: a.id,
    type: "announcement",
    title: `${byId.get(a.courseId)?.code ?? "Курс"}: ${a.title}`,
    body: `${a.body} — ${a.authorName}`,
    createdAt: a.createdAt,
    read: isRead(user.id, a.id),
    link: `/courses/${a.courseId}`,
  }));
  return NextResponse.json(
    [
      ...announcements,
      ...listPersonal(user.id).map((n) => ({ ...n, read: isRead(user.id, n.id) })),
      ...notifications.map((n) => ({ ...n, read: n.read || isRead(user.id, n.id) })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}
