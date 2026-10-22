import { courses as seed } from "@/mocks/data";
import { COVER_COLOR_KEYS } from "@/shared/lib/cover-colors";
import type { Activity, Course, Section } from "@/shared/types/domain";

// Курсы демо-режима: исходные моки + созданные в админке + правки карточки (название, статус…)
// + содержание из конструктора курса (модули и материалы).
// Id модулей и материалов исходных курсов уникальны только внутри курса (как в C#), новые — глобально.
type CourseMeta = Pick<Course, "title" | "description" | "category" | "tutorId" | "status">;

interface CourseState {
  created: Course[];
  patches: Map<string, Partial<CourseMeta>>;
  /** содержание, изменённое в конструкторе; нет записи — исходные модули курса */
  content: Map<string, Section[]>;
}
const g = globalThis as unknown as { __helios_courses?: CourseState };
const state: CourseState =
  g.__helios_courses ?? (g.__helios_courses = { created: [], patches: new Map(), content: new Map() });
// состояние могло быть создано прежней версией модуля (HMR) — без content
state.content ??= new Map();

const apply = (c: Course): Course => ({
  status: "published",
  ...c,
  ...state.patches.get(c.id),
  sections: state.content.get(c.id) ?? c.sections ?? [],
});

export function listDemoCourses(): Course[] {
  return [...seed, ...state.created].map(apply);
}

export function findDemoCourse(id: string): Course | undefined {
  return listDemoCourses().find((c) => c.id === id);
}

export function findDemoCourseByCode(code: string): Course | undefined {
  const normalized = code.trim().toUpperCase();
  return listDemoCourses().find((c) => c.code.toUpperCase() === normalized);
}

export function createDemoCourse(
  input: Pick<Course, "code" | "title" | "category" | "description" | "tutorId">,
): Course {
  const course: Course = {
    ...input,
    id: `c-${crypto.randomUUID().slice(0, 8)}`,
    code: input.code.trim().toUpperCase(),
    // цвет выбирается случайно один раз при создании и дальше хранится в курсе
    coverColor: COVER_COLOR_KEYS[Math.floor(Math.random() * COVER_COLOR_KEYS.length)],
    status: "draft",
    enrolled: 0,
    sections: [],
  };
  state.created.push(course);
  return course;
}

export function updateDemoCourse(id: string, patch: Partial<CourseMeta>): Course | undefined {
  if (!findDemoCourse(id)) return undefined;
  state.patches.set(id, { ...state.patches.get(id), ...patch });
  return findDemoCourse(id);
}

// ---- содержание курса (конструктор) ----

/** Изменяемая копия модулей курса: при первой правке исходные модули копируются целиком */
function editable(courseId: string): Section[] | undefined {
  if (state.content.has(courseId)) return state.content.get(courseId);
  const course = findDemoCourse(courseId);
  if (!course) return undefined;
  const copy = structuredClone(course.sections ?? []);
  state.content.set(courseId, copy);
  return copy;
}

const renumber = (sections: Section[]) => sections.forEach((s, i) => (s.order = i + 1));
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export function findActivity(courseId: string, activityId: string) {
  const course = findDemoCourse(courseId);
  for (const section of course?.sections ?? []) {
    const activity = section.activities.find((a) => a.id === activityId);
    if (activity && course) return { course, section, activity };
  }
  return undefined;
}

export function addSection(courseId: string, title: string): Section | undefined {
  const sections = editable(courseId);
  if (!sections) return undefined;
  const section: Section = {
    id: newId("s"),
    title: title.trim(),
    order: sections.length + 1,
    activities: [],
  };
  sections.push(section);
  return section;
}

export function renameSection(courseId: string, sectionId: string, title: string): Section | undefined {
  const section = editable(courseId)?.find((s) => s.id === sectionId);
  if (section) section.title = title.trim();
  return section;
}

/** Порядок модулей целиком; вернёт false, если список не совпадает с модулями курса */
export function reorderSections(courseId: string, sectionIds: string[]): Section[] | false {
  const sections = editable(courseId);
  if (
    !sections ||
    !sameSet(
      sections.map((s) => s.id),
      sectionIds,
    )
  )
    return false;
  sections.sort((a, b) => sectionIds.indexOf(a.id) - sectionIds.indexOf(b.id));
  renumber(sections);
  return sections;
}

export function deleteSection(courseId: string, sectionId: string): "ok" | "missing" | "not-empty" {
  const sections = editable(courseId);
  const i = sections?.findIndex((s) => s.id === sectionId) ?? -1;
  if (!sections || i < 0) return "missing";
  if (sections[i].activities.length) return "not-empty";
  sections.splice(i, 1);
  renumber(sections);
  return "ok";
}

export function addActivity(
  courseId: string,
  sectionId: string,
  input: Omit<Activity, "id">,
): Activity | undefined {
  const section = editable(courseId)?.find((s) => s.id === sectionId);
  if (!section) return undefined;
  const activity: Activity = { ...input, id: newId("a") };
  section.activities.push(activity);
  return activity;
}

/** Правка материала; sectionId — перенести в другой модуль (в конец). null в патче — убрать поле */
export function updateActivity(
  courseId: string,
  activityId: string,
  patch: Partial<Record<keyof Omit<Activity, "id" | "type">, unknown>> & { sectionId?: string },
): Activity | "missing" | "no-section" {
  const sections = editable(courseId);
  const from = sections?.find((s) => s.activities.some((a) => a.id === activityId));
  if (!sections || !from) return "missing";
  const activity = from.activities.find((a) => a.id === activityId)!;
  const { sectionId, ...fields } = patch;
  if (sectionId && sectionId !== from.id) {
    const to = sections.find((s) => s.id === sectionId);
    if (!to) return "no-section";
    from.activities = from.activities.filter((a) => a.id !== activityId);
    to.activities.push(activity);
  }
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (v === null) delete activity[k as keyof Activity];
    else Object.assign(activity, { [k]: v });
  }
  return activity;
}

export function reorderActivities(
  courseId: string,
  sectionId: string,
  activityIds: string[],
): Activity[] | false {
  const section = editable(courseId)?.find((s) => s.id === sectionId);
  if (
    !section ||
    !sameSet(
      section.activities.map((a) => a.id),
      activityIds,
    )
  )
    return false;
  section.activities.sort((a, b) => activityIds.indexOf(a.id) - activityIds.indexOf(b.id));
  return section.activities;
}

export function deleteActivity(courseId: string, activityId: string): boolean {
  const section = editable(courseId)?.find((s) => s.activities.some((a) => a.id === activityId));
  if (!section) return false;
  section.activities = section.activities.filter((a) => a.id !== activityId);
  return true;
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && new Set(b).size === b.length && a.every((x) => b.includes(x));
}
