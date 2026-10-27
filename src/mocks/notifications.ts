import "server-only";
import { notifications } from "@/mocks/data";
import { isRead, listAnnouncements, listPersonal } from "@/mocks/announcements-store";
import { visibleCourses } from "@/mocks/current-user";
import type { Notification, User } from "@/shared/types/domain";

/** Уведомления пользователя в демо: объявления видимых курсов, личные («оценка выставлена») и демонстрационные. */
export async function userNotifications(user: User): Promise<Notification[] | Response> {
  const courses = await visibleCourses();
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
  return [
    ...announcements,
    ...listPersonal(user.id).map((n) => ({ ...n, read: isRead(user.id, n.id) })),
    ...notifications.map((n) => ({ ...n, read: n.read || isRead(user.id, n.id) })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
