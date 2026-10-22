import "server-only";
import { getDemoActor } from "@/mocks/demo-actor";
import { listDemoCourses } from "@/mocks/course-store";
import { courseIdsForGroup } from "@/mocks/cohorts-store";
import type { Course } from "@/shared/types/domain";

// Какие курсы видит демо-пользователь — те же правила, что AccessRules.VisibleCourses в C#:
// студент — опубликованные курсы своей группы; преподаватель и управление — все.
// (Преподаватель в демо видит все курсы: все демокурсы ведёт он.)
export async function visibleDemoCourses(): Promise<Course[]> {
  const actor = await getDemoActor();
  const all = listDemoCourses();
  if (actor.role !== "student") return all;
  const enrolled = courseIdsForGroup(actor.group);
  return all.filter((c) => c.status === "published" && enrolled.has(c.id));
}
