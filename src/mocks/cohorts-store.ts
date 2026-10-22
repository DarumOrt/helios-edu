import { cohorts as seed, courses } from "@/mocks/data";
import { allDemoUsers, updateDemoUser } from "@/mocks/users-store";
import type { Cohort } from "@/shared/types/domain";

// Группы демо-режима. Состав не хранится: студент в группе, если user.group === cohort.name
// (так же устроено в C# — Account.Group). Здесь хранятся название, факультет и курсы группы.
type StoredCohort = Omit<Cohort, "memberIds">;

const g = globalThis as unknown as { __helios_cohorts?: StoredCohort[] };
const store: StoredCohort[] =
  g.__helios_cohorts ??
  (g.__helios_cohorts = seed.map(({ id, name }) => ({
    id,
    name,
    faculty: "ИНЭК",
    // М1217 изучает все демокурсы, у остальных групп курсов пока нет
    courseIds: name === "М1217" ? courses.map((c) => c.id) : [],
  })));

const withMembers = (c: StoredCohort): Cohort => ({
  ...c,
  memberIds: allDemoUsers()
    .filter((u) => u.role === "student" && u.group === c.name)
    .map((u) => u.id),
});

export function listCohorts(): Cohort[] {
  return store.map(withMembers);
}

export function findCohort(id: string): Cohort | undefined {
  const c = store.find((x) => x.id === id);
  return c && withMembers(c);
}

export function findCohortByName(name: string): Cohort | undefined {
  const normalized = name.trim().toLowerCase();
  const c = store.find((x) => x.name.toLowerCase() === normalized);
  return c && withMembers(c);
}

export function createCohort(input: { name: string; faculty?: string }): Cohort {
  const c: StoredCohort = {
    id: `co-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name.trim(),
    faculty: input.faculty,
    courseIds: [],
  };
  store.push(c);
  return withMembers(c);
}

export function updateCohort(
  id: string,
  patch: { name?: string; faculty?: string | null; courseIds?: string[] },
) {
  const c = store.find((x) => x.id === id);
  if (!c) return undefined;
  if (patch.name !== undefined && patch.name.trim() !== c.name) {
    // переименование группы переносит студентов: их group — это название
    for (const u of allDemoUsers()) if (u.group === c.name) u.group = patch.name.trim();
    c.name = patch.name.trim();
  }
  if (patch.faculty !== undefined) c.faculty = patch.faculty ?? undefined;
  if (patch.courseIds !== undefined) c.courseIds = [...new Set(patch.courseIds)];
  return withMembers(c);
}

/** Состав целиком: новые студенты переходят из прежних групп, убранные остаются без группы. */
export function setCohortMembers(id: string, memberIds: string[]) {
  const c = store.find((x) => x.id === id);
  if (!c) return undefined;
  const keep = new Set(memberIds);
  for (const u of allDemoUsers()) {
    if (u.group === c.name && !keep.has(u.id)) updateDemoUser(u.id, { group: undefined });
    if (keep.has(u.id)) updateDemoUser(u.id, { group: c.name });
  }
  return withMembers(c);
}

export function deleteCohort(id: string): boolean {
  const i = store.findIndex((x) => x.id === id);
  if (i < 0) return false;
  store.splice(i, 1);
  return true;
}

/** Курсы, на которые зачислен студент через свою группу */
export function courseIdsForGroup(group: string | undefined): Set<string> {
  const c = group ? store.find((x) => x.name === group) : undefined;
  return new Set(c?.courseIds ?? []);
}
