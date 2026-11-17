import type { Announcement, Notification, User } from "@/shared/types/domain";

// В ленте объявления видят все участники курса, в колокольчике — только студенты.
// Прочитанность — по пользователю; автора храним для проверки удаления.
interface Store {
  items: (Omit<Announcement, "canDelete"> & { authorId: string })[];
  read: Set<string>; // userId::announcementId
  /** личные уведомления («оценка выставлена»), как таблица Notifications в C# */
  personal: (Notification & { userId: string })[];
}
const g = globalThis as unknown as { __helios_announcements?: Store };
const store: Store =
  g.__helios_announcements ?? (g.__helios_announcements = { items: [], read: new Set(), personal: [] });
// состояние могло быть создано прежней версией модуля (HMR) — без personal
store.personal ??= [];

export function listAnnouncements(
  courseIds: Iterable<string>,
  actor?: Pick<User, "id" | "role">,
): Announcement[] {
  const ids = new Set(courseIds);
  return store.items
    .filter((a) => ids.has(a.courseId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ authorId, ...a }) => ({
      ...a,
      canDelete:
        !!actor &&
        (actor.role === "admin" ||
          actor.role === "organizer" ||
          (actor.role === "tutor" && authorId === actor.id)),
    }));
}

export function addAnnouncement(
  input: Omit<Announcement, "id" | "createdAt" | "canDelete"> & { authorId: string },
): Announcement {
  const item = {
    ...input,
    id: `an-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
  store.items.push(item);
  const { authorId: _author, ...a } = item;
  return { ...a, canDelete: true };
}

export function removeAnnouncement(courseId: string, id: string) {
  store.items = store.items.filter((a) => a.courseId !== courseId || a.id !== id);
  for (const key of store.read) if (key.endsWith(`::${id}`)) store.read.delete(key);
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
