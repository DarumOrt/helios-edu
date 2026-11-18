"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Card, Table, THead, TR, TH, TD, Button, Input, Select } from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { CohortDialog } from "@/features/admin/components/CohortDialog";
import { DirectoryPagination } from "@/features/admin/components/DirectoryPagination";
import { facultyName } from "@/shared/lib/faculties";
import type { CohortDirectory } from "@/shared/types/domain";

const defaults = { q: "", faculty: "", year: "", occupancy: "", sort: "name", page: "1" };

export default function AdminCohortsPage() {
  const role = useSession((s) => s.role);
  const [filters, setFilters] = useState(defaults);
  const query = useDeferredValue(filters.q.trim());
  const params = new URLSearchParams({ ...filters, q: query });
  if (!filters.year) params.delete("year");
  const { data, error, isLoading } = useSWR<CohortDirectory>(`/api/cohorts/directory?${params}`, fetcher, {
    keepPreviousData: true,
  });
  const [creating, setCreating] = useState(false);
  const setFilter = (key: keyof typeof defaults, value: string) =>
    setFilters((current) => ({ ...current, page: "1", [key]: value }));
  const filtered = Object.keys(defaults).some(
    (key) =>
      key !== "page" && filters[key as keyof typeof defaults] !== defaults[key as keyof typeof defaults],
  );

  return (
    <div>
      <PageHeader
        title="Группы"
        actions={
          can(role, "cohort.manage") && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden /> Создать группу
            </Button>
          )
        }
      />
      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          <Input
            type="search"
            aria-label="Поиск группы"
            placeholder="Название группы"
            maxLength={120}
            value={filters.q}
            onChange={(event) => setFilter("q", event.target.value)}
            className="col-span-2 min-w-0 md:col-span-1"
          />
          <Select
            aria-label="Факультет"
            value={filters.faculty}
            onChange={(event) => setFilter("faculty", event.target.value)}
            className="min-w-0"
          >
            <option value="">Все факультеты</option>
            {data?.faculties.map((value) => (
              <option key={value} value={value}>
                {facultyName(value)}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Курс обучения"
            value={filters.year}
            onChange={(event) => setFilter("year", event.target.value)}
            className="min-w-0"
          >
            <option value="">Курс: все</option>
            {data?.years.map((value) => (
              <option key={value} value={value}>
                {value} курс
              </option>
            ))}
          </Select>
          <Select
            aria-label="Наполняемость"
            value={filters.occupancy}
            onChange={(event) => setFilter("occupancy", event.target.value)}
            className="min-w-0"
          >
            <option value="">Все группы</option>
            <option value="occupied">Со студентами</option>
            <option value="empty">Пустые</option>
          </Select>
          <Select
            aria-label="Сортировка"
            value={filters.sort}
            onChange={(event) => setFilter("sort", event.target.value)}
            className="min-w-0"
          >
            <option value="name">Название А–Я</option>
            <option value="name-desc">Название Я–А</option>
            <option value="most-students">Больше студентов</option>
            <option value="fewest-students">Меньше студентов</option>
          </Select>
        </div>
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {data ? `Найдено: ${data.total}` : ""}
          </p>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(defaults)}>
              Сбросить фильтры
            </Button>
          )}
        </div>
      </div>
      <Card className="overflow-hidden">
        <DataState
          loading={isLoading}
          error={error}
          empty={!data?.items.length}
          emptyTitle="Группы не найдены"
        >
          <Table>
            <THead>
              <TR>
                <TH>Группа</TH>
                <TH>Студентов</TH>
                <TH>Курсов</TH>
              </TR>
            </THead>
            <tbody>
              {data?.items.map((cohort) => (
                <TR key={cohort.id}>
                  <TD>
                    <Link
                      href={`/admin/cohorts/${cohort.id}`}
                      className="font-medium wrap-anywhere hover:text-primary hover:underline"
                    >
                      {cohort.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {[cohort.faculty, cohort.year ? `${cohort.year} курс` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </TD>
                  <TD className="font-mono tabular-nums">{cohort.students}</TD>
                  <TD className="font-mono tabular-nums">{cohort.courses}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          {data && (
            <DirectoryPagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onChange={(value) => setFilter("page", String(value))}
            />
          )}
        </DataState>
      </Card>
      {creating && <CohortDialog open onClose={() => setCreating(false)} />}
    </div>
  );
}
