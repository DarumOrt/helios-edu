import { api } from "@/shared/lib/api-client";
import type { Notification } from "@/shared/types/domain";

export const notificationsApi = {
  list: () => api.get<Notification[]>("/api/notifications"),
  markRead: (id: string) => api.post(`/api/notifications/${id}/read`, {}),
};
