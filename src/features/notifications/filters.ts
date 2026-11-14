import type { Notification } from "@/shared/types/domain";

export interface NotificationFilters {
  unread: boolean;
  course: string;
  type: string;
  q: string;
}

export function filterNotifications(items: Notification[], filters: NotificationFilters) {
  const query = filters.q.trim().toLocaleLowerCase("ru");
  return items.filter(
    (n) =>
      (!filters.unread || !n.read) &&
      (!filters.course || (n.courseId ?? "personal") === filters.course) &&
      (!filters.type || n.type === filters.type) &&
      (!query || `${n.title} ${n.body} ${n.courseTitle ?? ""}`.toLocaleLowerCase("ru").includes(query)),
  );
}

export function groupNotifications(items: Notification[]) {
  const groups = new Map<string, { id: string; title: string; items: Notification[] }>();
  for (const item of [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const id = item.courseId ?? "personal";
    const group = groups.get(id) ?? {
      id,
      title: item.courseTitle ?? (item.courseId ? "Курс" : "Личные уведомления"),
      items: [],
    };
    group.items.push(item);
    groups.set(id, group);
  }
  return [...groups.values()];
}
