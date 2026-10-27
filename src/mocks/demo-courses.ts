import "server-only";
import { getDemoActor } from "@/mocks/demo-actor";
import { listDemoCourses } from "@/mocks/course-store";
import { courseIdsForGroup } from "@/mocks/cohorts-store";
import { withViewerStats } from "@/mocks/course-stats";
import type { Course } from "@/shared/types/domain";

// Какие курсы видит демо-пользователь — те же правила, что AccessRules.VisibleCourses в C#:
// студент — опубликованные курсы своей группы; преподаватель — свои; управление — все.
// Участники, прогресс и «пройдено» — для этого пользователя (course-stats.ts).
export async function visibleDemoCourses(): Promise<Course[]> {
  const actor = await getDemoActor();
  return visibleFor(actor).map((c) => withViewerStats(c, actor));
}

function visibleFor(actor: Awaited<ReturnType<typeof getDemoActor>>): Course[] {
  const all = listDemoCourses();
  if (actor.role === "tutor") return all.filter((c) => c.tutorId === actor.id);
  if (actor.role !== "student") return all;
  const enrolled = courseIdsForGroup(actor.group);
  return all.filter((c) => c.status === "published" && enrolled.has(c.id));
}
