"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronRight, Plus } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Card, Table, THead, TR, TH, TD, Button, Badge } from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { CohortDialog } from "@/features/admin/components/CohortDialog";
import type { Cohort } from "@/shared/types/domain";

export default function AdminCohortsPage() {
  const role = useSession((s) => s.role);
  const { data, error, isLoading } = useSWR<Cohort[]>("/api/cohorts", fetcher);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Группы"
        subtitle="Студенты группы видят курсы, закреплённые за ней"
        actions={
          can(role, "cohort.manage") && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden />
              Создать группу
            </Button>
          )
        }
      />
      <Card className="overflow-hidden">
        <DataState loading={isLoading} error={error} empty={!data?.length} emptyTitle="Групп пока нет">
          <Table>
            <THead>
              <TR>
                <TH>Группа</TH>
                <TH>Студентов</TH>
                <TH>Курсов</TH>
                <TH>Статус</TH>
                <TH>
                  <span className="sr-only">Открыть</span>
                </TH>
              </TR>
            </THead>
            <tbody>
              {data?.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/admin/cohorts/${c.id}`} className="font-medium hover:text-primary">
                      {c.name}
                    </Link>
                    {c.faculty && <div className="text-xs text-muted-foreground">{c.faculty}</div>}
                  </TD>
                  <TD className="font-mono tabular-nums">{c.memberIds.length}</TD>
                  <TD className="font-mono tabular-nums">{c.courseIds?.length ?? 0}</TD>
                  <TD>
                    <Badge tone={c.memberIds.length > 0 ? "success" : "neutral"}>
                      {c.memberIds.length > 0 ? "учится" : "пустая"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/admin/cohorts/${c.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Открыть <ChevronRight size={14} aria-hidden />
                    </Link>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </DataState>
      </Card>
      {creating && <CohortDialog open onClose={() => setCreating(false)} />}
    </div>
  );
}
