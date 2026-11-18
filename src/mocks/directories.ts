import { listCohorts } from "@/mocks/cohorts-store";
import { directoryDemoUsers } from "@/mocks/users-store";
import type { CohortDirectory, UserDirectory } from "@/shared/types/domain";

const compare = (a: string, b: string) => a.localeCompare(b, "ru", { numeric: true });
const abbreviations = (rows: { faculty?: string }[]) =>
  [...new Set(rows.flatMap((row) => (row.faculty ? [row.faculty] : [])))].sort(compare);

function paginate<T>(rows: T[], query: URLSearchParams) {
  const pageSize = 25;
  const requested = Number(query.get("page")) || 1;
  const page = Math.max(1, Math.min(Math.trunc(requested), Math.ceil(rows.length / pageSize)));
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

export function userDirectory(query: URLSearchParams): UserDirectory {
  const users = directoryDemoUsers();
  const search = query.get("q")?.trim().toLowerCase() ?? "";
  const role = query.get("role");
  const status = query.get("status");
  const faculty = query.get("faculty");
  const group = query.get("group");
  const ungrouped = query.get("ungrouped") === "true";
  const sort = query.get("sort");
  const rows = users.filter(
    (user) =>
      (!search ||
        [user.name, user.email, user.group].some((value) => value?.toLowerCase().includes(search))) &&
      (!role || (user.role ?? user.status) === role) &&
      (!status || (user.status ?? "active") === status) &&
      (!faculty || user.faculty === faculty) &&
      (ungrouped ? !user.group : !group || user.group === group),
  );
  rows.sort((a, b) => {
    if (sort === "newest" || sort === "oldest") {
      const known = Number(!a.createdAt) - Number(!b.createdAt);
      if (known) return known;
      const time = compare(a.createdAt ?? "", b.createdAt ?? "");
      if (time) return sort === "newest" ? -time : time;
    }
    const name = compare(a.name, b.name);
    return (sort === "name-desc" ? -name : name) || compare(a.id, b.id);
  });
  return {
    ...paginate(rows, query),
    pendingCount: users.filter((user) => user.status === "pending").length,
    faculties: abbreviations(users),
    groups: listCohorts()
      .map((cohort) => cohort.name)
      .sort(compare),
  };
}

export function cohortDirectory(query: URLSearchParams): CohortDirectory {
  const cohorts = listCohorts();
  const search = query.get("q")?.trim().toLowerCase() ?? "";
  const faculty = query.get("faculty");
  const year = query.get("year");
  const occupancy = query.get("occupancy");
  const sort = query.get("sort");
  const items = cohorts
    .map(({ id, name, faculty, year, memberIds, courseIds }) => ({
      id,
      name,
      faculty,
      year,
      students: memberIds.length,
      courses: courseIds?.length ?? 0,
    }))
    .filter(
      (cohort) =>
        cohort.name.toLowerCase().includes(search) &&
        (!faculty || cohort.faculty === faculty) &&
        (!year || cohort.year === Number(year)) &&
        (occupancy === "empty" ? cohort.students === 0 : occupancy !== "occupied" || cohort.students > 0),
    )
    .sort((a, b) => {
      const name = compare(a.name, b.name);
      if (sort === "most-students") return b.students - a.students || name;
      if (sort === "fewest-students") return a.students - b.students || name;
      return sort === "name-desc" ? -name : name;
    });
  return {
    ...paginate(items, query),
    faculties: abbreviations(cohorts),
    years: [...new Set(cohorts.flatMap((cohort) => (cohort.year === undefined ? [] : [cohort.year])))].sort(
      (a, b) => a - b,
    ),
  };
}
