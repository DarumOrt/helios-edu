import { api } from "@/shared/lib/api-client";
import type { CoverColor } from "@/shared/lib/cover-colors";
import type { Course } from "@/shared/types/domain";

export const coursesApi = {
  list: () => api.get<Course[]>("/api/courses"),
  byId: (id: string) => api.get<Course>(`/api/courses/${id}`),
  /** cover: data URL своей картинки или null, чтобы вернуть шаблон */
  updateCover: (id: string, patch: { coverColor?: CoverColor; cover?: string | null }) =>
    api.put<Course>(`/api/courses/${id}/cover`, patch),
};
