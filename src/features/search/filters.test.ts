import { describe, expect, it } from "vitest";
import { applyFilters, coursesCount, facets, hasFilters } from "./filters";
import type { CatalogCourse } from "@/shared/types/domain";

const course = (id: string, patch: Partial<CatalogCourse> = {}): CatalogCourse => ({
  id,
  code: "ЦОР-201",
  title: "Практикум по ЦОР",
  description: "Цифровые ресурсы",
  category: "ЦОР",
  faculty: "ИНЭК",
  academicYear: "2026/2027",
  tutor: { id: "u-tutor-1", name: "Казаринова Н.Л." },
  cohorts: [
    {
      id: "co-1",
      name: "М1227",
      year: 2,
      level: "master",
      directionCode: "44.04.01",
      direction: "Педагогическое образование",
      profile: "Искусственный интеллект в образовании",
    },
  ],
  sections: [],
  accessible: true,
  ...patch,
});

const list = [
  course("a"),
  course("b", {
    title: "Анализ данных",
    tutor: { id: "u-tutor-4", name: "Симакина Н.И." },
    faculty: "МФ",
    cohorts: [],
  }),
];

describe("поиск курсов", () => {
  it("ищет по преподавателю и профилю без учёта регистра", () => {
    expect(applyFilters(list, { q: "казаринова" }).map((c) => c.id)).toEqual(["a"]);
    expect(applyFilters(list, { q: "ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ" }).map((c) => c.id)).toEqual(["a"]);
  });

  it("все слова запроса должны найтись", () => {
    expect(applyFilters(list, { q: "анализ симакина" }).map((c) => c.id)).toEqual(["b"]);
    expect(applyFilters(list, { q: "анализ казаринова" })).toEqual([]);
  });

  it("фильтры факультета, курса обучения и направления", () => {
    expect(applyFilters(list, { faculty: "МФ" }).map((c) => c.id)).toEqual(["b"]);
    expect(applyFilters(list, { studyYear: "master-2" }).map((c) => c.id)).toEqual(["a"]);
    expect(applyFilters(list, { direction: "44.04.01" }).map((c) => c.id)).toEqual(["a"]);
  });

  it("варианты фильтров — только встречающиеся в курсах", () => {
    const f = facets(list);
    expect(f.studyYear).toEqual([{ value: "master-2", label: "2 курс · магистратура" }]);
    expect(f.tutor.map((t) => t.label)).toEqual(["Казаринова Н.Л.", "Симакина Н.И."]);
    expect(f.faculty).toHaveLength(13);
  });

  it("запрос из одних пробелов — не фильтр", () => {
    expect(hasFilters({ q: "   " })).toBe(false);
    expect(hasFilters({ tutor: "u-tutor-1" })).toBe(true);
  });

  it("склонение «курс»", () => {
    expect([0, 1, 2, 5, 11, 21, 22, 25].map(coursesCount)).toEqual([
      "нет курсов",
      "1 курс",
      "2 курса",
      "5 курсов",
      "11 курсов",
      "21 курс",
      "22 курса",
      "25 курсов",
    ]);
  });
});
