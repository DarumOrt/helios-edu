import type { Activity, Course, GradeRow, StudentCourseGrades } from "@/shared/types/domain";
import { gradebook as seedGradebook } from "./data";
import { allDemoUsers } from "./users-store";
import { courseIdsForGroup } from "./cohorts-store";
import { findDemoCourse, listDemoCourses } from "./course-store";
import { listSubmissions } from "./submissions-store";
import { submittedAttempts } from "./adaptive-store";

// Журнал оценок демо — как Grades/GradesEndpoints.cs: строки — студенты групп курса, колонки — задания
// и тесты курса (новый материал из конструктора сразу становится колонкой). Оценка в клетке —
// поставленная преподавателем (вручную или при проверке работы), иначе для теста — лучшая попытка.

interface Store {
  /** оценки преподавателя: courseId/itemId/userId → балл */
  manual: Map<string, number>;
  seeded: boolean;
}

const g = globalThis as unknown as { __helios_gradebook2?: Store };
const store: Store = g.__helios_gradebook2 ?? (g.__helios_gradebook2 = { manual: new Map(), seeded: false });

const key = (courseId: string, itemId: string, userId: string) => `${courseId}/${itemId}/${userId}`;

function seed() {
  if (store.seeded) return;
  store.seeded = true;
  for (const [courseId, rows] of Object.entries(seedGradebook))
    for (const row of rows)
      for (const item of row.items)
        if (item.grade != null) store.manual.set(key(courseId, item.itemId, row.userId), item.grade);
}

const maxOf = (a: Activity) => a.maxGrade ?? 100;

function columns(course: Course): Activity[] {
  return (course.sections ?? [])
    .flatMap((s) => s.activities)
    .filter((a) => a.type === "assignment" || a.type === "quiz");
}

/** Ученики курса — студенты групп, которым он назначен (AccessRules.CourseStudents) */
function students(courseId: string) {
  return allDemoUsers()
    .filter((u) => u.role === "student" && courseIdsForGroup(u.group).has(courseId))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

/** Оценки ученика по колонкам: преподавателя (в т. ч. проверенная работа), иначе лучшая попытка теста */
function marks(courseId: string, userId: string): Map<string, number> {
  seed();
  const result = new Map<string, number>();
  for (const a of submittedAttempts(courseId).filter((x) => x.userId === userId && x.max > 0)) {
    const percent = Math.round((100 * (a.score ?? 0)) / a.max);
    if (percent > (result.get(a.activityId) ?? -1)) result.set(a.activityId, percent);
  }
  // проверенные работы начальных данных — как оценка преподавателя
  for (const s of listSubmissions({ status: "reviewed", courseId }))
    if (s.userId === userId && s.grade != null) result.set(s.assignmentId, s.grade);
  for (const [k, value] of store.manual) {
    const [c, itemId, u] = k.split("/");
    if (c === courseId && u === userId) result.set(itemId, value);
  }
  return result;
}

function row(cols: Activity[], userId: string, courseId: string) {
  const m = marks(courseId, userId);
  const items = cols.map((a) => ({
    itemId: a.id,
    itemTitle: a.title,
    grade: m.get(a.id) ?? null,
    max: maxOf(a),
  }));
  // итог — средний процент по колонкам, непроставленная оценка — ноль
  const total = items.length
    ? Math.round((items.reduce((sum, i) => sum + (100 * (i.grade ?? 0)) / i.max, 0) / items.length) * 10) / 10
    : 0;
  return { items, total };
}

export function getCourseGrades(courseId: string): GradeRow[] {
  const course = findDemoCourse(courseId);
  if (!course) return [];
  const cols = columns(course);
  return students(courseId).map((u) => ({ userId: u.id, userName: u.name, ...row(cols, u.id, courseId) }));
}

/** Оценка преподавателя (null — снять, для теста вернётся лучшая попытка). null в ответе — нет такого ученика или колонки */
export function setGrade(
  courseId: string,
  userId: string,
  itemId: string,
  grade: number | null,
): GradeRow | null {
  seed();
  const course = findDemoCourse(courseId);
  const student = students(courseId).find((u) => u.id === userId);
  if (!course || !student || !columns(course).some((a) => a.id === itemId)) return null;
  if (grade == null) store.manual.delete(key(courseId, itemId, userId));
  else store.manual.set(key(courseId, itemId, userId), grade);
  return { userId, userName: student.name, ...row(columns(course), userId, courseId) };
}

/**
 * Оценки ученика: курсы его группы и курсы, где у него есть оценки (после перевода в другую группу
 * они остаются, как в C#); черновики не показываем.
 */
export function getStudentGrades(userId: string): StudentCourseGrades[] {
  seed();
  const user = allDemoUsers().find((u) => u.id === userId);
  const mine = courseIdsForGroup(user?.group);
  return listDemoCourses()
    .filter(
      (c) =>
        (mine.has(c.id) && c.status !== "draft" && c.status !== "archived") ||
        (c.status !== "draft" && marks(c.id, userId).size > 0),
    )
    .map((c) => ({ course: c, cols: columns(c) }))
    .filter(({ cols }) => cols.length > 0)
    .map(({ course, cols }) => ({
      courseId: course.id,
      courseTitle: course.title,
      courseCode: course.code,
      ...row(cols, userId, course.id),
    }));
}
