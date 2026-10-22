import { api } from "@/shared/lib/api-client";

export const assignmentApi = {
  // id материалов уникальны только внутри курса — курс передаём всегда; userId сверяет сервер
  submit: (
    courseId: string,
    assignmentId: string,
    payload: { text: string; fileName?: string; userId: string },
  ) =>
    api.post<{ id: string; status: string }>(`/api/assignment/${assignmentId}/submit`, {
      courseId,
      ...payload,
    }),
};
