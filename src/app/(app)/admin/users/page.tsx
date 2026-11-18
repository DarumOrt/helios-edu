"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import {
  PageHeader,
  DataState,
  Card,
  Table,
  THead,
  TR,
  TH,
  TD,
  Button,
  Badge,
  Input,
  Select,
} from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { canManageUser } from "@/shared/auth/management";
import { UserDialog } from "@/features/admin/components/UserDialog";
import { ApplicationDialog } from "@/features/admin/components/ApplicationDialog";
import { DirectoryPagination } from "@/features/admin/components/DirectoryPagination";
import { roleLabel } from "@/features/admin/labels";
import { facultyName } from "@/shared/lib/faculties";
import { formatDate } from "@/shared/lib/format";
import type { Cohort, DirectoryUser, UserDirectory } from "@/shared/types/domain";

const defaults = { q: "", role: "", status: "", faculty: "", group: "", sort: "name", page: "1" };

export default function AdminUsersPage() {
  const actor = useSession((s) => s.user);
  const [filters, setFilters] = useState(defaults);
  const query = useDeferredValue(filters.q.trim());
  const params = new URLSearchParams({ ...filters, q: query });
  if (filters.group === "#none") {
    params.delete("group");
    params.set("ungrouped", "true");
  }
  const { data, error, isLoading } = useSWR<UserDirectory>(`/api/users/directory?${params}`, fetcher, {
    keepPreviousData: true,
  });
  const [editing, setEditing] = useState<DirectoryUser | null | undefined>(undefined);
  const isApplication = editing?.status === "pending";
  const { data: cohorts } = useSWR<Cohort[]>(
    editing !== undefined && !isApplication ? "/api/cohorts" : null,
    fetcher,
  );
  const setFilter = (key: keyof typeof defaults, value: string) =>
    setFilters((current) => ({ ...current, page: "1", [key]: value }));
  const filtered = Object.keys(defaults).some(
    (key) =>
      key !== "page" && filters[key as keyof typeof defaults] !== defaults[key as keyof typeof defaults],
  );

  return (
    <div>
      <PageHeader
        title="Пользователи"
        actions={
          <>
            {can(actor.role, "system.manage") && (
              <Link
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                href="/admin/users/import"
              >
                Импорт из CSV
              </Link>
            )}
            {can(actor.role, "user.manage") && (
              <Button onClick={() => setEditing(null)}>
                <Plus size={16} aria-hidden /> Добавить пользователя
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            aria-pressed={filters.role !== "pending"}
            variant={filters.role === "pending" ? "outline" : "primary"}
            onClick={() => setFilters(defaults)}
          >
            Все пользователи
          </Button>
          <Button
            aria-pressed={filters.role === "pending"}
            variant={filters.role === "pending" ? "primary" : "outline"}
            onClick={() => setFilters({ ...defaults, role: "pending" })}
          >
            Без роли{data ? ` · ${data.pendingCount}` : ""}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Input
            type="search"
            aria-label="Поиск пользователя"
            placeholder="Имя, почта, группа"
            maxLength={120}
            value={filters.q}
            onChange={(event) => setFilter("q", event.target.value)}
            className="col-span-2 min-w-0 md:col-span-1"
          />
          <Select
            aria-label="Роль"
            value={filters.role}
            onChange={(event) => setFilter("role", event.target.value)}
            className="min-w-0"
          >
            <option value="">Все роли</option>
            <option value="pending">Без роли</option>
            {Object.entries(roleLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Статус"
            value={filters.status}
            onChange={(event) => setFilter("status", event.target.value)}
            className="min-w-0"
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="blocked">Заблокированные</option>
            <option value="pending">На рассмотрении</option>
          </Select>
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
            aria-label="Группа"
            value={filters.group}
            onChange={(event) => setFilter("group", event.target.value)}
            className="min-w-0"
          >
            <option value="">Все группы</option>
            <option value="#none">Без группы</option>
            {data?.groups.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Сортировка"
            value={filters.sort}
            onChange={(event) => setFilter("sort", event.target.value)}
            className="col-span-2 min-w-0 md:col-span-1"
          >
            <option value="name">Имя А–Я</option>
            <option value="name-desc">Имя Я–А</option>
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
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
          emptyTitle={filters.role === "pending" ? "Нет подходящих заявок" : "Пользователи не найдены"}
        >
          <Table className="table-fixed">
            <colgroup>
              <col />
              <col className="w-36 sm:w-44" />
            </colgroup>
            <THead>
              <TR>
                <TH>Пользователь</TH>
                <TH>Действие</TH>
              </TR>
            </THead>
            <tbody>
              {data?.items.map((user) => (
                <TR key={user.id}>
                  <TD>
                    <div className="font-medium wrap-anywhere">{user.name}</div>
                    <div className="text-xs wrap-anywhere text-muted-foreground">{user.email}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge tone={user.role ? "outline" : "warning"}>
                        {user.role ? roleLabel[user.role] : "Без роли"}
                      </Badge>
                      {user.status === "blocked" && <Badge tone="danger">Заблокирован</Badge>}
                      {user.id === actor.id && <Badge tone="outline">Вы</Badge>}
                      {user.group && <span>{user.group}</span>}
                      {user.faculty && <span title={facultyName(user.faculty)}>{user.faculty}</span>}
                      {user.createdAt && <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time>}
                    </div>
                  </TD>
                  <TD>
                    <Button
                      variant={user.status === "pending" ? "outline" : "ghost"}
                      size="sm"
                      className="h-auto min-h-8 max-w-full py-1.5 whitespace-normal"
                      onClick={() => setEditing(user)}
                      disabled={!canManageUser(actor, user)}
                    >
                      {user.status === "pending" ? "Назначить роль" : "Изменить"}
                    </Button>
                  </TD>
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
      {editing !== undefined &&
        (isApplication ? (
          <ApplicationDialog
            application={editing}
            groups={data?.groups ?? []}
            onClose={() => setEditing(undefined)}
          />
        ) : (
          <UserDialog
            key={editing?.id ?? "new"}
            open
            onClose={() => setEditing(undefined)}
            user={editing ?? undefined}
            actor={actor}
            cohorts={cohorts ?? []}
          />
        ))}
    </div>
  );
}
