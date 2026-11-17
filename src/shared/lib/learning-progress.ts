import type { Course } from "@/shared/types/domain";
import { hasActivityPage } from "@/shared/lib/activity-href";

export function materialProgress(courses: readonly Pick<Course, "sections">[]) {
  let done = 0;
  let total = 0;
  for (const course of courses) {
    for (const section of course.sections ?? []) {
      total += section.activities.length;
      done += section.activities.filter((activity) => activity.completed).length;
    }
  }
  return { done, total, percent: total ? Math.floor((done / total) * 100) : 0 };
}

export function nextCourseMaterial(course: Course) {
  for (const section of course.sections ?? []) {
    const activity = section.activities.find(
      (activity) => !activity.completed && hasActivityPage(activity.type),
    );
    if (activity) return { section, activity };
  }
  return null;
}

export function pendingDeadlines(courses: readonly Course[]) {
  return courses
    .flatMap((course) =>
      (course.sections ?? []).flatMap((section) =>
        section.activities.flatMap((activity) =>
          activity.due && !activity.completed ? [{ course, activity, due: activity.due }] : [],
        ),
      ),
    )
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}
