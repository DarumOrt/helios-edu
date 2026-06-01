import { api } from "@/shared/lib/api-client";
import type { GradeRow } from "@/shared/types/domain";

export interface StudentCourseGrades {
  courseId: string;
  courseTitle: string;
  courseCode: string;
  items: { itemId: string; itemTitle: string; grade: number | null; max: number }[];
  total: number;
}

export const gradebookApi = {
  forCourse: (courseId: string) => api.get<GradeRow[]>(`/api/gradebook?courseId=${courseId}`),
  setGrade: (courseId: string, userId: string, itemId: string, grade: number | null) =>
    api.post<GradeRow>("/api/gradebook/grade", { courseId, userId, itemId, grade }),
};
