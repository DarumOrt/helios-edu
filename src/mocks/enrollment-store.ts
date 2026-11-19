import "server-only";
import { createHash } from "node:crypto";
import { courseIdsForGroup, listCohorts } from "@/mocks/cohorts-store";
import { allDemoUsers } from "@/mocks/users-store";
import type { EnrollmentInfo, EnrolledStudent, User } from "@/shared/types/domain";

type Source = "manual" | "self";
interface Store {
  exclusions: Map<string, Set<string>>;
  keys: Map<string, string>;
  students: Map<string, Map<string, Source>>;
}
const g = globalThis as unknown as { __helios_enrollment?: Store };
const store = (g.__helios_enrollment ??= { keys: new Map(), students: new Map(), exclusions: new Map() });
store.exclusions ??= new Map();
export const isExcluded = (id: string, userId: string) => store.exclusions.get(id)?.has(userId) ?? false;
export function excludeStudents(id: string, userIds: string[]) {
  const excluded = store.exclusions.get(id) ?? new Set<string>();
  for (const userId of userIds) excluded.add(userId);
  store.exclusions.set(id, excluded);
}
export function restoreStudent(id: string, user: User) {
  if (store.exclusions.get(id)?.delete(user.id) && !isEnrolled(id, user))
    enrollStudent(id, user.id, "manual");
}
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
export function removeIndividualEnrollment(id: string, userId: string) {
  store.students.get(id)?.delete(userId);
}
export function isEnrolled(id: string, user: Pick<User, "id" | "group">) {
  if (isExcluded(id, user.id)) return false;
  return courseIdsForGroup(user.group).has(id) || (store.students.get(id)?.has(user.id) ?? false);
}
export function enrollmentInfo(id: string, tenant: string): EnrollmentInfo {
  return {
    keyEnabled: selfEnrollmentEnabled(id),
    cohortIds: listCohorts()
      .filter((g) => g.courseIds.includes(id))
      .map((g) => g.id),
    excluded: allDemoUsers()
      .filter((u) => u.role === "student" && u.tenantId === tenant && isExcluded(id, u.id))
      .map((u) => ({ id: u.id, name: u.name, email: u.email, group: u.group, sources: [] })),
    students: allDemoUsers()
      .filter((u) => u.tenantId === tenant && u.role === "student" && isEnrolled(id, u))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .map((u): EnrolledStudent => {
        const sources: EnrolledStudent["sources"] = courseIdsForGroup(u.group).has(id) ? ["group"] : [];
        const individual = store.students.get(id)?.get(u.id);
        if (individual) sources.push(individual);
        return { id: u.id, name: u.name, email: u.email, group: u.group, sources };
      }),
  };
}
