"use client";

import { useDeferredValue, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Search, ShieldAlert } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { formatDateTime } from "@/shared/lib/format";
import {
  Button,
  Card,
  DataState,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { roleLabel } from "@/features/admin/labels";
import { AUDIT_CATEGORIES } from "@/shared/lib/audit-labels";
import type { AuditChange, AuditPage, Role } from "@/shared/types/domain";

interface Filters {
  q: string;
  category: string;
  role: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { q: "", category: "", role: "", from: "", to: "" };

// Журнал действий: кто, когда и что изменил. Фильтры и постраничная загрузка — на сервере (GET /api/audit).
export default function AuditPage() {
  const role = useSession((s) => s.role);
  const allowed = can(role, "system.manage");
  const [filters, setFilters] = useState(EMPTY);
  // поиск не дёргает сервер на каждую букву
  const q = useDeferredValue(filters.q.trim());
  const params = new URLSearchParams(
    Object.entries({ ...filters, q }).filter(([, value]) => value) as [string, string][],
  );
  const { data, error, isLoading, size, setSize, isValidating } = useSWRInfinite<AuditPage>(
    (index, previous: AuditPage | null) => {
      if (!allowed || (previous && !previous.nextCursor)) return null;
      const page = new URLSearchParams(params);
      if (previous?.nextCursor) page.set("cursor", String(previous.nextCursor));
      return `/api/audit?${page}`;
    },
    fetcher,
  );
  const set = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));

  if (!allowed)
    return (
      <EmptyState icon={ShieldAlert} title="Доступ ограничен" description="Раздел доступен администратору." />
    );

  const rows = data?.flatMap((page) => page.items) ?? [];
  const more = Boolean(data?.[data.length - 1]?.nextCursor);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div>
      <PageHeader
        title="Журнал действий"
        subtitle="Кто и когда входил, менял пользователей, группы, курсы, оценки и настройки"
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            size={16}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="Поиск по журналу"
            placeholder="Кто, что или над чем"
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          aria-label="Раздел"
          value={filters.category}
          onChange={(e) => set("category", e.target.value)}
        >
          <option value="">Все действия</option>
          {AUDIT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Роль" value={filters.role} onChange={(e) => set("role", e.target.value)}>
          <option value="">Все роли</option>
          {(Object.keys(roleLabel) as Role[]).map((r) => (
            <option key={r} value={r}>
              {roleLabel[r]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          с
          <Input
            type="date"
            aria-label="С даты"
            value={filters.from}
            onChange={(e) => set("from", e.target.value)}
            className="w-auto"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          по
          <Input
            type="date"
            aria-label="По дату"
            value={filters.to}
            onChange={(e) => set("to", e.target.value)}
            className="w-auto"
          />
        </label>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY)}>
            Сбросить
          </Button>
        )}
      </div>
      <Card className="overflow-hidden">
        <DataState
          loading={isLoading}
          error={error}
          empty={!rows.length}
          emptyTitle={filtered ? "Ничего не нашли" : "Пока никто ничего не менял"}
        >
          <Table>
            <THead>
              <TR>
                <TH>Когда</TH>
                <TH>Кто</TH>
                <TH>Действие</TH>
                <TH>Над чем</TH>
                <TH>Что изменилось</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((e) => (
                <TR key={e.id}>
                  <TD className="font-mono text-xs whitespace-nowrap">{formatDateTime(e.at)}</TD>
                  <TD>
                    <div className="font-medium">{e.actorName}</div>
                    <div className="text-xs text-muted-foreground">
                      {roleLabel[e.actorRole as Role] ?? "без входа"}
                    </div>
                  </TD>
                  <TD>{e.actionText}</TD>
                  <TD className="text-muted-foreground">{e.target}</TD>
                  <TD>
                    <Changes changes={e.changes} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </DataState>
      </Card>
      {more && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => setSize(size + 1)} disabled={isValidating}>
            {isValidating ? "Загружаем…" : "Показать ещё"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Changes({ changes }: { changes?: AuditChange[] }) {
  if (!changes?.length) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="space-y-0.5 text-xs">
      {changes.map((c) => (
        <li key={c.field}>
          <span className="text-muted-foreground">{c.field}:</span>{" "}
          {c.before && <span className="line-through decoration-danger/60">{c.before}</span>}
          {c.before && c.after && " → "}
          {c.after && <span className="font-medium">{c.after}</span>}
        </li>
      ))}
    </ul>
  );
}
