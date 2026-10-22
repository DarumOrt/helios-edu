import { NextResponse } from "next/server";
import { notifications } from "@/mocks/data";
import { isRead, listAnnouncements } from "@/mocks/announcements-store";
import { currentUser, visibleCourses } from "@/mocks/current-user";
import type { Notification } from "@/shared/types/domain";

// Уведомления: демонстрационные + объявления курсов, которые видит пользователь.
export async function GET() {
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
    [...announcements, ...notifications.map((n) => ({ ...n, read: n.read || isRead(user.id, n.id) }))].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    ),
  );
}
