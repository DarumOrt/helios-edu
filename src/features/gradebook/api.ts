import { api } from "@/shared/lib/api-client";
import type { GradeRow } from "@/shared/types/domain";

export const gradebookApi = {
  forCourse: (courseId: string) => api.get<GradeRow[]>(`/api/gradebook?courseId=${courseId}`),
};
