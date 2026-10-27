import "server-only";
import { listDemoCourses } from "@/mocks/course-store";
import { listCohorts } from "@/mocks/cohorts-store";
import { findDemoUser } from "@/mocks/users-store";
import { visibleDemoCourses } from "@/mocks/demo-courses";
import { withCover } from "@/mocks/course-cover-store";
import type { CatalogCourse } from "@/shared/types/domain";

// Поиск курсов в демо — те же правила, что CatalogEndpoints в C#: опубликованные курсы для всех ролей,
// без материалов; accessible — курс виден пользователю целиком (visibleDemoCourses).
export async function demoCatalog(): Promise<CatalogCourse[]> {
  const visible = new Set((await visibleDemoCourses()).map((c) => c.id));
  const cohorts = listCohorts().sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return listDemoCourses()
    .filter((c) => c.status === "published")
    .map(withCover)
    .map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      description: c.description,
      cover: c.cover,
      coverColor: c.coverColor,
      category: c.category,
      faculty: c.faculty,
      academicYear: c.academicYear,
      tutor: { id: c.tutorId, name: findDemoUser(c.tutorId)?.name ?? "" },
      cohorts: cohorts
        .filter((g) => g.courseIds.includes(c.id))
        .map(({ id, name, year, level, directionCode, direction, profile }) => ({
          id,
          name,
          year,
          level,
          directionCode,
          direction,
          profile,
        })),
      sections: (c.sections ?? []).map((s) => ({ title: s.title, activities: s.activities.length })),
      accessible: visible.has(c.id),
    }));
}
