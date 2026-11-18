import "server-only";
import { FACULTIES } from "@/shared/lib/faculties";
import type { FacultyInfo } from "@/shared/types/api.gen";

const state = globalThis as typeof globalThis & { heliosFaculties?: FacultyInfo[] };
export function demoFaculties() {
  return (state.heliosFaculties ??= FACULTIES.map((f) => ({ ...f, archived: false })));
}
export function demoFacultyCodes(previous?: string) {
  return demoFaculties()
    .filter((f) => !f.archived || f.code === previous)
    .map((f) => f.code);
}
