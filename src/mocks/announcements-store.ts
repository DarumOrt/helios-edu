import type { Announcement, Notification } from "@/shared/types/domain";

// Объявления курсов. Получатели не хранятся: объявление видят все, кому виден курс
// (так приватность совпадает с правами на курс). Прочитанность — по пользователю.
interface Store {
  items: Announcement[];
  read: Set<string>; // userId::announcementId
  /** личные уведомления («оценка выставлена»), как таблица Notifications в C# */
  personal: (Notification & { userId: string })[];
}
const g = globalThis as unknown as { __helios_announcements?: Store };
const store: Store =
  g.__helios_announcements ?? (g.__helios_announcements = { items: [], read: new Set(), personal: [] });
// состояние могло быть создано прежней версией модуля (HMR) — без personal
store.personal ??= [];

export function listAnnouncements(courseIds: Iterable<string>): Announcement[] {
  const ids = new Set(courseIds);
  return store.items
    .filter((a) => ids.has(a.courseId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addAnnouncement(input: Omit<Announcement, "id" | "createdAt">): Announcement {
  const item: Announcement = {
    ...input,
    id: `an-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
  store.items.push(item);
  return item;
}

export const isRead = (userId: string, id: string) => store.read.has(`${userId}::${id}`);
export const markRead = (userId: string, id: string) => store.read.add(`${userId}::${id}`);

export function addPersonal(userId: string, n: Omit<Notification, "id" | "createdAt" | "read">) {
  store.personal.push({
    ...n,
    userId,
    id: `n-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    read: false,
  });
}

export const listPersonal = (userId: string): Notification[] =>
  store.personal.filter((n) => n.userId === userId).map(({ userId: _u, ...n }) => n);
