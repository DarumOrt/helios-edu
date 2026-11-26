"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Layers3, Search, X } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { useFaculties } from "@/shared/lib/use-faculties";
import { facultyName } from "@/shared/lib/faculties";
import { Button, DataState, EmptyState, Input, Select } from "@/shared/ui";
import type { CatalogCourse } from "@/shared/types/domain";
import type { CatalogCollectionInfo } from "@/shared/types/api.gen";
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
  const {
    data: collections,
    error: collectionError,
    isLoading: loadingCollections,
  } = useSWR<CatalogCollectionInfo[]>("/api/catalog-collections", fetcher);
  const { data: facultyDirectory } = useFaculties();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const collectionId = params.get("collection");
  const selectedCollection = collections?.find((item) => item.id === collectionId);

  const filters: Filters = Object.fromEntries(
    (["q", ...FILTER_KEYS] as const).map((k) => [k, params.get(k) ?? undefined]),
  );
  const courses = useMemo(() => data ?? [], [data]);
  const faculties = useMemo(
    () => (facultyDirectory ?? []).filter((f) => !f.archived || courses.some((c) => c.faculty === f.code)),
    [facultyDirectory, courses],
  );
  const available = useMemo(
    () =>
      collectionId ? courses.filter((course) => selectedCollection?.courseIds.includes(course.id)) : courses,
    [collectionId, courses, selectedCollection],
  );
  const options = useMemo(() => facets(available, faculties), [available, faculties]);
  const results = applyFilters(available, filters);
  const active = Boolean(collectionId) || hasFilters(filters);

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
          Найдите курс по названию, преподавателю, группе или направлению подготовки
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
            placeholder="Название или код курса"
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

      <DataState
        loading={isLoading || Boolean(collectionId && loadingCollections)}
        error={error ?? (collectionId ? collectionError : undefined)}
      >
        {active ? (
          <section aria-labelledby="search-results" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="search-results"
                className="text-sm font-medium text-muted-foreground"
                aria-live="polite"
              >
                {selectedCollection ? (
                  <>
                    <span className="block text-lg font-semibold text-foreground">
                      {selectedCollection.name}
                    </span>
                    {coursesCount(results.length)}
                  </>
                ) : (
                  <>
                    {filters.faculty && !filters.q && (
                      <span className="mr-2 font-semibold">
                        {facultyName(filters.faculty, facultyDirectory ?? [])}
                      </span>
                    )}
                    {coursesCount(results.length)}
                  </>
                )}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => router.replace(pathname, { scroll: false })}>
                {filters.faculty && !filters.q ? (
                  <ArrowLeft size={16} aria-hidden />
                ) : (
                  <X size={16} aria-hidden />
                )}
                {collectionId
                  ? "Весь каталог"
                  : filters.faculty && !filters.q
                    ? "Все факультеты"
                    : "Сбросить"}
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
                title={collectionId && !selectedCollection ? "Раздел недоступен" : "Курсов не нашлось"}
                description={
                  filters.faculty && !filters.q
                    ? "На этом факультете курсы ещё не созданы."
                    : "Попробуйте другое слово или уберите часть фильтров."
                }
                action={
                  <Link href={pathname} className="text-sm text-primary underline-offset-4 hover:underline">
                    Вернуться в каталог
                  </Link>
                }
              />
            )}
          </section>
        ) : (
          <>
            {!!collections?.length && (
              <section aria-labelledby="catalog-collections" className="space-y-3">
                <h2 id="catalog-collections" className="text-sm font-medium text-muted-foreground">
                  Межфакультетские разделы
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {collections.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`${pathname}?collection=${encodeURIComponent(item.id)}`}
                        className="flex h-full min-h-16 items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-card hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                      >
                        <Layers3 size={20} className="shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold wrap-break-word">{item.name}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {item.facultyCodes.join(", ")}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {coursesCount(item.courseIds.length)}
                          </span>
                        </span>
                        <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <FacultyGrid faculties={faculties} courses={courses} onPick={(faculty) => update({ faculty })} />
          </>
        )}
      </DataState>
    </div>
  );
}
