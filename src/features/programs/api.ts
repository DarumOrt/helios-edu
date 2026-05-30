import { api } from "@/shared/lib/api-client";
import type { Program } from "@/shared/types/domain";

export const programsApi = {
  list: () => api.get<Program[]>("/api/programs"),
};
