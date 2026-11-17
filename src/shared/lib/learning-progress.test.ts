import { describe, expect, it } from "vitest";
import type { Activity, Course } from "@/shared/types/domain";
import { materialProgress, nextCourseMaterial, pendingDeadlines } from "./learning-progress";

function course(id: string, activities: Activity[]): Course {
  return {
    id,
    code: id,
    title: id,
    category: "",
    description: "",
    tutorId: "tutor",
    enrolled: 1,
    progress: 100,
    sections: [{ id: "module", order: 1, title: "Модуль", activities }],
  };
}

describe("показатели учёбы", () => {
  it("считает материалы по всем курсам, даже если идентификаторы совпадают", () => {
    const first = course("first", [{ id: "a1", type: "quiz", title: "Тест", completed: true }]);
    const second = course("second", [{ id: "a1", type: "quiz", title: "Тест" }]);
    expect(materialProgress([first, second])).toEqual({ done: 1, total: 2, percent: 50 });
    expect(materialProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("пропускает завершённые материалы и старые записи без страницы", () => {
    const value = course("first", [
      { id: "a1", type: "video", title: "Лекция", completed: true },
      { id: "a2", type: "file", title: "Архивная запись" },
      { id: "a3", type: "pdf", title: "Конспект" },
    ]);
    expect(nextCourseMaterial(value)?.activity.id).toBe("a3");
    expect(materialProgress([value])).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it("пропускает сданное и сортирует сроки по моменту, а не по строке", () => {
    const a = course("first", [
      { id: "due", type: "assignment", title: "Работа", due: "2026-11-20T14:00:00+05:00" },
      { id: "done", type: "assignment", title: "Завершено", due: "2026-11-18T09:00:00Z", completed: true },
    ]);
    const b = course("second", [{ id: "due", type: "quiz", title: "Тест", due: "2026-11-20T10:00:00Z" }]);
    expect(pendingDeadlines([b, a]).map(({ course }) => course.id)).toEqual(["first", "second"]);
  });
});
