"use client";

import useSWR from "swr";
import { fetcher } from "./api-client";
import type { FacultyInfo } from "@/shared/types/api.gen";

export function useFaculties() {
  return useSWR<FacultyInfo[]>("/api/faculties", fetcher);
}
