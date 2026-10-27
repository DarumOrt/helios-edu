import "server-only";
import { allDemoUsers } from "@/mocks/users-store";
import { courseIdsForGroup } from "@/mocks/cohorts-store";
import { completed, progress } from "@/mocks/adaptive-store";
import type { Course, User } from "@/shared/types/domain";

// Числа карточки курса для того, кто смотрит, — как Courses/CourseProgress.cs в C#:
// участники — студенты групп курса; прогресс по формуле P5 (ученику — свой, остальным — средний);
// «пройдено» у материалов — только ученику и только своё.
export function withViewerStats(course: Course, viewer: User): Course {
  const students = allDemoUsers().filter(
    (u) => u.role === "student" && courseIdsForGroup(u.group).has(course.id),
  );
  const sections = (course.sections ?? []).map((s) => ({
    ...s,
    activities: s.activities.map(({ completed: _static, ...a }) => a),
  }));
  const base: Course = { ...course, sections, enrolled: students.length, progress: undefined };
  if (viewer.role === "student") {
    const done = completed(viewer.id, course.id);
    return {
      ...base,
      progress: progress(course, viewer.id).progress,
      sections: sections.map((s) => ({
        ...s,
        activities: s.activities.map((a) => (done.has(a.id) ? { ...a, completed: true } : a)),
      })),
    };
  }
  if (!students.length) return base;
  const average = students.reduce((sum, u) => sum + progress(course, u.id).progress, 0) / students.length;
  return { ...base, progress: Math.round(average) };
}
