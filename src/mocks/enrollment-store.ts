import "server-only";
import { createHash } from "node:crypto";
import { courseIdsForGroup, listCohorts } from "@/mocks/cohorts-store";
import { allDemoUsers } from "@/mocks/users-store";
import type { EnrollmentInfo, EnrolledStudent, User } from "@/shared/types/domain";

type Source = "manual" | "self";
interface Store {
  keys: Map<string, string>;
  students: Map<string, Map<string, Source>>;
}
const g = globalThis as unknown as { __helios_enrollment?: Store };
const store = (g.__helios_enrollment ??= { keys: new Map(), students: new Map() });
const hash = (value: string) => createHash("sha256").update(value.trim()).digest("hex");
export const selfEnrollmentEnabled = (id: string) => store.keys.has(id);
export const matchesKeyword = (id: string, value: string) => store.keys.get(id) === hash(value);
export function setKeyword(id: string, value: string | null) {
  if (value === null) store.keys.delete(id);
  else store.keys.set(id, hash(value));
}
export function enrollStudent(id: string, userId: string, source: Source) {
  const students = store.students.get(id) ?? new Map<string, Source>();
  if (!students.has(userId)) students.set(userId, source);
  store.students.set(id, students);
}
export function isEnrolled(id: string, user: Pick<User, "id" | "group">) {
  return courseIdsForGroup(user.group).has(id) || (store.students.get(id)?.has(user.id) ?? false);
}
export function enrollmentInfo(id: string, tenant: string): EnrollmentInfo {
  return {
    keyEnabled: selfEnrollmentEnabled(id),
    cohortIds: listCohorts()
      .filter((g) => g.courseIds.includes(id))
      .map((g) => g.id),
    students: allDemoUsers()
      .filter((u) => u.tenantId === tenant && u.role === "student" && isEnrolled(id, u))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .map((u): EnrolledStudent => ({
        id: u.id,
        name: u.name,
        email: u.email,
        group: u.group,
        source: courseIdsForGroup(u.group).has(id) ? "group" : store.students.get(id)!.get(u.id)!,
      })),
  };
}
