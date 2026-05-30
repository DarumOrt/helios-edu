import { api } from "@/shared/lib/api-client";
import type { User, Cohort, Course } from "@/shared/types/domain";

export const adminApi = {
  users: () => api.get<User[]>("/api/users"),
  cohorts: () => api.get<Cohort[]>("/api/cohorts"),
  courses: () => api.get<Course[]>("/api/courses"),
};
