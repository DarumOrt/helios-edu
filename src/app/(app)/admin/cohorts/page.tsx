"use client";

import useSWR from "swr";
import { Plus, Settings2, UsersRound } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Card, Table, THead, TR, TH, TD, Button, Badge } from "@/shared/ui";
import type { Cohort } from "@/shared/types/domain";

export default function AdminCohortsPage() {
  const { data, error, isLoading } = useSWR<Cohort[]>("/api/cohorts", fetcher);

  return (
    <div>
      <PageHeader
        title="Группы (когорты)"
        actions={
          <Button>
            <Plus size={16} />
            Создать группу
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <DataState loading={isLoading} error={error} empty={!data?.length}>
          <Table>
            <THead>
              <TR>
                <TH>Группа</TH>
                <TH>Участников</TH>
                <TH>Статус</TH>
                <TH></TH>
              </TR>
            </THead>
            <tbody>
              {data?.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-primary-soft text-primary flex items-center justify-center shrink-0">
                        <UsersRound size={15} />
                      </div>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </TD>
                  <TD className="tabular-nums">{c.memberIds.length}</TD>
                  <TD>
                    <Badge tone={c.memberIds.length > 0 ? "success" : "neutral"}>
                      {c.memberIds.length > 0 ? "активна" : "пустая"}
                    </Badge>
                  </TD>
                  <TD>
                    <Button variant="ghost" size="sm">
                      <Settings2 size={13} />
                      Управление
                    </Button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </DataState>
      </Card>
    </div>
  );
}
