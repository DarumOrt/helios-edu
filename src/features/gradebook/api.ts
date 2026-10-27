import { api } from "@/shared/lib/api-client";
import type { GradeRow, StudentCourseGrades } from "@/shared/types/domain";

export type { StudentCourseGrades };

export const gradebookApi = {
  forCourse: (courseId: string) => api.get<GradeRow[]>(`/api/gradebook?courseId=${courseId}`),
  setGrade: (courseId: string, userId: string, itemId: string, grade: number | null) =>
    api.post<GradeRow>("/api/gradebook/grade", { courseId, userId, itemId, grade }),
};
