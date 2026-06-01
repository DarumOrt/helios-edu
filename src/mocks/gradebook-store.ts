import type { GradeRow } from "@/shared/types/domain";
import { gradebook as seedGradebook, courses } from "./data";

// In-memory журнал оценок (мок) с поддержкой редактирования преподавателем.

interface Store {
  byCourse: Record<string, GradeRow[]>;
  seeded: boolean;
}

const g = globalThis as unknown as { __helios_gradebook?: Store };
const store: Store = g.__helios_gradebook ?? (g.__helios_gradebook = { byCourse: {}, seeded: false });

function seed() {
  if (store.seeded) return;
  store.seeded = true;
  // глубокая копия сид-данных
  store.byCourse = JSON.parse(JSON.stringify(seedGradebook));
}

function recalcTotal(row: GradeRow) {
  if (!row.items.length) {
    row.total = 0;
    return;
  }
  const sum = row.items.reduce((s, it) => s + (it.grade ?? 0), 0);
  row.total = Math.round((sum / row.items.length) * 10) / 10;
}

export function getCourseGrades(courseId: string): GradeRow[] {
  seed();
  return store.byCourse[courseId] ?? [];
}

export function setGrade(courseId: string, userId: string, itemId: string, grade: number | null): GradeRow | null {
  seed();
  const rows = store.byCourse[courseId];
  if (!rows) return null;
  const row = rows.find((r) => r.userId === userId);
  if (!row) return null;
  const item = row.items.find((i) => i.itemId === itemId);
  if (!item) return null;
  item.grade = grade;
  recalcTotal(row);
  return row;
}

export interface StudentCourseGrades {
  courseId: string;
  courseTitle: string;
  courseCode: string;
  items: { itemId: string; itemTitle: string; grade: number | null; max: number }[];
  total: number;
}

export function getStudentGrades(userId: string): StudentCourseGrades[] {
  seed();
  const result: StudentCourseGrades[] = [];
  for (const [courseId, rows] of Object.entries(store.byCourse)) {
    const row = rows.find((r) => r.userId === userId);
    if (!row) continue;
    const course = courses.find((c) => c.id === courseId);
    result.push({
      courseId,
      courseTitle: course?.title ?? courseId,
      courseCode: course?.code ?? "",
      items: row.items,
      total: row.total,
    });
  }
  return result;
}
