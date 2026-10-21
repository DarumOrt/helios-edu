import type { Course } from "@/shared/types/domain";
import type { CoverColor } from "@/shared/lib/cover-colors";

// Изменения обложек курсов поверх моков. Живёт на globalThis, чтобы переживать HMR в dev;
// сбрасывается при перезапуске сервера. В проде: загрузка в объектное хранилище, в курсе — URL.

interface CoverOverride {
  coverColor?: CoverColor;
  /** data URL загруженной картинки; null — картинка явно удалена */
  cover?: string | null;
}

const g = globalThis as unknown as { __helios_covers?: Map<string, CoverOverride> };
const store: Map<string, CoverOverride> = g.__helios_covers ?? (g.__helios_covers = new Map());

export function setCover(courseId: string, patch: CoverOverride) {
  store.set(courseId, { ...store.get(courseId), ...patch });
}

export function withCover<T extends Pick<Course, "id" | "cover" | "coverColor">>(course: T): T {
  const o = store.get(course.id);
  if (!o) return course;
  return {
    ...course,
    coverColor: o.coverColor ?? course.coverColor,
    cover: o.cover === null ? undefined : (o.cover ?? course.cover),
  };
}
