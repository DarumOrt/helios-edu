import type { Announcement } from "@/shared/types/domain";

// Объявления курсов. Получатели не хранятся: объявление видят все, кому виден курс
// (так приватность совпадает с правами на курс). Прочитанность — по пользователю.
interface Store {
  items: Announcement[];
  read: Set<string>; // userId::announcementId
}
const g = globalThis as unknown as { __helios_announcements?: Store };
const store: Store = g.__helios_announcements ?? (g.__helios_announcements = { items: [], read: new Set() });

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
