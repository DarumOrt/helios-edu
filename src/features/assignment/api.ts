import { api } from "@/shared/lib/api-client";

export const assignmentApi = {
  submit: (assignmentId: string, payload: { text: string; fileName?: string }) =>
    api.post<{ ok: true; submissionId: string }>(`/api/assignment/${assignmentId}/submit`, payload),
};
