import { courses as seed } from "@/mocks/data";
import { COVER_COLOR_KEYS } from "@/shared/lib/cover-colors";
import type { Course } from "@/shared/types/domain";

// Курсы демо-режима: исходные моки + созданные в админке + правки карточки (название, статус…).
// Содержание (модули, материалы) у созданных курсов пока пустое — конструктор курса в P2.
type CourseMeta = Pick<Course, "title" | "description" | "category" | "tutorId" | "status">;

interface CourseState {
  created: Course[];
  patches: Map<string, Partial<CourseMeta>>;
}
const g = globalThis as unknown as { __helios_courses?: CourseState };
const state: CourseState = g.__helios_courses ?? (g.__helios_courses = { created: [], patches: new Map() });

const apply = (c: Course): Course => ({ status: "published", ...c, ...state.patches.get(c.id) });

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
