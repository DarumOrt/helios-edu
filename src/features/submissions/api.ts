import { api } from "@/shared/lib/api-client";
import type { Submission } from "@/shared/types/domain";

export interface SubmissionFull extends Submission {
  userName: string;
  group?: string;
  assignmentTitle: string;
  courseId: string;
  courseTitle: string;
  maxGrade: number;
}

export const submissionsApi = {
  review: (id: string, grade: number, feedback: string) =>
    api.post<SubmissionFull>(`/api/submissions/${id}/review`, { grade, feedback }),
};
