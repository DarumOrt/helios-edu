"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Search, X } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { facultyName } from "@/shared/lib/faculties";
import { Button, DataState, EmptyState, Input, Select } from "@/shared/ui";
import type { CatalogCourse } from "@/shared/types/domain";
import {
  FILTER_KEYS,
  applyFilters,
  coursesCount,
  facets,
  hasFilters,
  type FilterKey,
  type Filters,
} from "../filters";
import { FacultyGrid } from "./FacultyGrid";
import { CatalogResult } from "./CatalogResult";

const filterLabels: Record<FilterKey, string> = {
  faculty: "Факультет",
  direction: "Направление",
  studyYear: "Курс обучения",
  academicYear: "Учебный год",
  tutor: "Преподаватель",
  discipline: "Дисциплина",
};

export function CourseSearch() {
  const { data, error, isLoading } = useSWR<CatalogCourse[]>("/api/catalog", fetcher);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters: Filters = Object.fromEntries(
    (["q", ...FILTER_KEYS] as const).map((k) => [k, params.get(k) ?? undefined]),
  );
  const courses = useMemo(() => data ?? [], [data]);
  const options = useMemo(() => facets(courses), [courses]);
  const results = applyFilters(courses, filters);
  const active = hasFilters(filters);

  // Фильтры — в адресе страницы: поиском можно поделиться, «назад» возвращает прошлый фильтр
  function update(patch: Filters) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-8">
      <section className="mx-auto max-w-3xl pt-2 text-center sm:pt-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Поиск курсов</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Все курсы ПГГПУ: по названию, преподавателю, группе или направлению подготовки
        </p>
        <form
          role="search"
          className="relative mt-6"
          onSubmit={(e) => e.preventDefault()}
          aria-label="Поиск курсов"
        >
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={filters.q ?? ""}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Например, анализ данных или Казаринова"
            aria-label="Название курса, преподаватель или группа"
            className="h-12 rounded-xl pr-4 pl-11 text-base shadow-card"
          />
        </form>

        <div className="mt-4 grid grid-cols-2 gap-2 text-left sm:grid-cols-3">
          {FILTER_KEYS.map((key) => (
            <label key={key} className="min-w-0">
              <span className="sr-only">{filterLabels[key]}</span>
              <Select
                value={filters[key] ?? ""}
                onChange={(e) => update({ [key]: e.target.value })}
                className="h-9 w-full truncate text-sm"
              >
                <option value="">{filterLabels[key]}: все</option>
                {options[key].map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
          ))}
        </div>
      </section>

      <DataState loading={isLoading} error={error}>
        {active ? (
          <section aria-labelledby="search-results" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="search-results"
                className="text-sm font-medium text-muted-foreground"
                aria-live="polite"
              >
                {filters.faculty && !filters.q ? `${facultyName(filters.faculty)} · ` : "Найдено: "}
                {coursesCount(results.length)}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => router.replace(pathname, { scroll: false })}>
                {filters.faculty && !filters.q ? (
                  <ArrowLeft size={16} aria-hidden />
                ) : (
                  <X size={16} aria-hidden />
                )}
                {filters.faculty && !filters.q ? "Все факультеты" : "Сбросить"}
              </Button>
            </div>
            {results.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {results.map((c) => (
                  <li key={c.id}>
                    <CatalogResult course={c} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Search}
                title="Курсов не нашлось"
                description={
                  filters.faculty && !filters.q
                    ? "На этом факультете курсы ещё не созданы."
                    : "Попробуйте другое слово или уберите часть фильтров."
                }
                action={
                  <Link href={pathname} className="text-sm text-primary underline-offset-4 hover:underline">
                    Показать все факультеты
                  </Link>
                }
              />
            )}
          </section>
        ) : (
          <FacultyGrid courses={courses} onPick={(faculty) => update({ faculty })} />
        )}
      </DataState>
    </div>
  );
}
