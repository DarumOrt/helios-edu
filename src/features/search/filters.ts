import { FACULTIES } from "@/shared/lib/faculties";
import type { CatalogCohort, CatalogCourse } from "@/shared/types/domain";

// Фильтры поиска курсов. Состояние живёт в адресе страницы (?q=…&faculty=…), чтобы поиском можно было поделиться.
export const FILTER_KEYS = [
  "faculty",
  "direction",
  "studyYear",
  "academicYear",
  "tutor",
  "discipline",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey | "q", string>>;

export interface Option {
  value: string;
  label: string;
}

// «ё» и регистр не мешают найти курс
const norm = (s: string) => s.toLowerCase().replaceAll("ё", "е").trim();

const levelLabel = { bachelor: "бакалавриат", master: "магистратура" } as const;

/** «2 курс · магистратура» — курс обучения группы */
export function studyYearOf(c: CatalogCohort): Option | null {
  if (!c.year || !c.level) return null;
  return { value: `${c.level}-${c.year}`, label: `${c.year} курс · ${levelLabel[c.level]}` };
}

export function directionOf(c: CatalogCohort): Option | null {
  if (!c.directionCode || !c.direction) return null;
  return { value: c.directionCode, label: `${c.directionCode} ${c.direction}` };
}

function unique(options: (Option | null)[]): Option[] {
  const map = new Map<string, Option>();
  for (const o of options) if (o && !map.has(o.value)) map.set(o.value, o);
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

/** Значения для выпадающих списков — только те, что встречаются в курсах */
export function facets(courses: CatalogCourse[]): Record<FilterKey, Option[]> {
  const cohorts = courses.flatMap((c) => c.cohorts);
  return {
    faculty: FACULTIES.map((f) => ({ value: f.code, label: f.name })),
    direction: unique(cohorts.map(directionOf)),
    studyYear: unique(cohorts.map(studyYearOf)),
    academicYear: unique(
      courses.map((c) => (c.academicYear ? { value: c.academicYear, label: c.academicYear } : null)),
    ),
    tutor: unique(courses.map((c) => (c.tutor.name ? { value: c.tutor.id, label: c.tutor.name } : null))),
    discipline: unique(courses.map((c) => ({ value: c.title, label: c.title }))),
  };
}

function haystack(c: CatalogCourse): string {
  return norm(
    [
      c.title,
      c.code,
      c.description,
      c.category,
      c.tutor.name,
      c.faculty,
      ...c.cohorts.flatMap((g) => [g.name, g.direction, g.profile]),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function applyFilters(courses: CatalogCourse[], f: Filters): CatalogCourse[] {
  const words = norm(f.q ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return courses.filter((c) => {
    if (f.faculty && c.faculty !== f.faculty) return false;
    if (f.academicYear && c.academicYear !== f.academicYear) return false;
    if (f.tutor && c.tutor.id !== f.tutor) return false;
    if (f.discipline && c.title !== f.discipline) return false;
    if (f.direction && !c.cohorts.some((g) => g.directionCode === f.direction)) return false;
    if (f.studyYear && !c.cohorts.some((g) => studyYearOf(g)?.value === f.studyYear)) return false;
    if (words.length) {
      const text = haystack(c);
      if (!words.every((w) => text.includes(w))) return false;
    }
    return true;
  });
}

export const hasFilters = (f: Filters) => Boolean(f.q?.trim()) || FILTER_KEYS.some((k) => f[k]);

/** «4 курса», «1 курс», «нет курсов» */
export function coursesCount(n: number): string {
  if (n === 0) return "нет курсов";
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "курс"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "курса"
        : "курсов";
  return `${n} ${word}`;
}
