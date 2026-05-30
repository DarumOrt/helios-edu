import { api } from "@/shared/lib/api-client";
import type { Course } from "@/shared/types/domain";

export const coursesApi = {
  list: () => api.get<Course[]>("/api/courses"),
  byId: (id: string) => api.get<Course>(`/api/courses/${id}`),
};
