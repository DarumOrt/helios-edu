"use client";

import { useState } from "react";
import useSWR from "swr";
import { Search, ShieldAlert } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { formatDateTime } from "@/shared/lib/format";
import { Card, DataState, EmptyState, Input, PageHeader, Table, TD, TH, THead, TR } from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { roleLabel } from "@/features/admin/labels";
import type { Role } from "@/shared/types/domain";

interface Entry {
  id: string;
  at: string;
  actorName: string;
  actorRole: Role;
  action: string;
  target: string;
}

export default function AuditPage() {
  const role = useSession((s) => s.role);
  const allowed = can(role, "system.manage");
  const { data, error, isLoading } = useSWR<Entry[]>(allowed ? "/api/audit" : null, fetcher, {
    refreshInterval: 10_000,
  });
  const [query, setQuery] = useState("");

  if (!allowed)
    return (
      <EmptyState icon={ShieldAlert} title="Доступ ограничен" description="Раздел доступен администратору." />
    );

  const q = query.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (e) => !q || [e.actorName, e.action, e.target].some((s) => s.toLowerCase().includes(q)),
  );

  return (
    <div>
      <PageHeader
        title="Журнал действий"
        subtitle="Кто и когда менял пользователей, группы, курсы, оценки и настройки"
      />
      <div className="relative mb-4 max-w-sm">
        <Search
          size={16}
          className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          aria-label="Поиск по журналу"
          placeholder="Кто, что или над чем"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <Card className="overflow-hidden">
        <DataState
          loading={isLoading}
          error={error}
          empty={!rows.length}
          emptyTitle={data?.length ? "Ничего не нашли" : "Пока никто ничего не менял"}
        >
          <Table>
            <THead>
              <TR>
                <TH>Когда</TH>
                <TH>Кто</TH>
                <TH>Действие</TH>
                <TH>Что</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((e) => (
                <TR key={e.id}>
                  <TD className="font-mono text-xs whitespace-nowrap">{formatDateTime(e.at)}</TD>
                  <TD>
                    <div className="font-medium">{e.actorName}</div>
                    <div className="text-xs text-muted-foreground">{roleLabel[e.actorRole]}</div>
                  </TD>
                  <TD>{e.action}</TD>
                  <TD className="text-muted-foreground">{e.target}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </DataState>
      </Card>
    </div>
  );
}
