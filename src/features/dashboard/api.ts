import { api } from "@/shared/lib/api-client";
import type { Course, Notification } from "@/shared/types/domain";

export const dashboardApi = {
  myCourses: () => api.get<Course[]>("/api/courses"),
  notifications: () => api.get<Notification[]>("/api/notifications"),
};
