import { api } from "@/shared/lib/api-client";
import type { SubmissionFull } from "@/shared/types/domain";

export type { SubmissionFull };

export const submissionsApi = {
  review: (id: string, grade: number, feedback: string) =>
    api.post<SubmissionFull>(`/api/submissions/${id}/review`, { grade, feedback }),
};
