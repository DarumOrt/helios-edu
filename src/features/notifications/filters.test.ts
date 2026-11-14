import { expect, it } from "vitest";
import type { Notification } from "@/shared/types/domain";
import { filterNotifications, groupNotifications } from "./filters";

const items: Notification[] = [
  {
    id: "a",
    type: "announcement",
    title: "Консультация",
    body: "Аудитория 10",
    courseId: "c1",
    courseTitle: "Математика",
    read: false,
    createdAt: "2026-11-14T10:00:00Z",
  },
  {
    id: "b",
    type: "grade",
    title: "Оценка",
    body: "90",
    courseId: "c2",
    courseTitle: "Физика",
    read: true,
    createdAt: "2026-11-14T12:00:00Z",
  },
  {
    id: "c",
    type: "deadline",
    title: "Срок",
    body: "Завтра",
    courseId: "c1",
    courseTitle: "Математика",
    read: false,
    createdAt: "2026-11-14T11:00:00Z",
  },
  {
    id: "d",
    type: "forum",
    title: "Ответ",
    body: "Обсуждение",
    read: false,
    createdAt: "2026-11-13T10:00:00Z",
  },
];
it("совмещает курс, тип, непрочитанность и поиск по названию курса", () => {
  const filters = { course: "c1", unread: true, type: "announcement", q: "МАТЕМАТИКА" };
  expect(filterNotifications(items, filters).map((n) => n.id)).toEqual(["a"]);
  expect(filterNotifications(items, { ...filters, q: "Физика" })).toEqual([]);
  expect(
    filterNotifications(items, { course: "personal", unread: false, type: "", q: "" }).map((n) => n.id),
  ).toEqual(["d"]);
});
it("объединяет один курс, личные — отдельно; группы и сообщения по убыванию времени", () => {
  const grouped = groupNotifications(items);
  expect(grouped.map((g) => g.id)).toEqual(["c2", "c1", "personal"]);
  expect(grouped[1].items.map((n) => n.id)).toEqual(["c", "a"]);
  expect(items[0].id).toBe("a");
});
