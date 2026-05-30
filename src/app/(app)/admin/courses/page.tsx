"use client";

import useSWR from "swr";
import { Plus, Edit2 } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Card, Table, THead, TR, TH, TD, Button, Badge } from "@/shared/ui";
import { gradientFor } from "@/shared/lib/utils";
import type { Course } from "@/shared/types/domain";

export default function AdminCoursesPage() {
  const { data, error, isLoading } = useSWR<Course[]>("/api/courses", fetcher);

  return (
    <div>
      <PageHeader
        title="Управление курсами"
        actions={
          <Button>
            <Plus size={16} />
            Создать курс
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <DataState loading={isLoading} error={error} empty={!data?.length}>
          <Table>
            <THead>
              <TR>
                <TH>Курс</TH>
                <TH>Категория</TH>
                <TH>Студентов</TH>
                <TH>Статус</TH>
                <TH></TH>
              </TR>
            </THead>
            <tbody>
              {data?.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${gradientFor(c.id)} text-white text-[10px] font-semibold flex items-center justify-center shrink-0`}>
                        {c.code.split("-")[0]}
                      </div>
                      <div>
                        <div className="font-medium">{c.title}</div>
                        <div className="text-[11px] text-muted-foreground">{c.code}</div>
                      </div>
                    </div>
                  </TD>
                  <TD><Badge tone="outline">{c.category}</Badge></TD>
                  <TD className="tabular-nums">{c.enrolled}</TD>
                  <TD><Badge tone="success">опубликован</Badge></TD>
                  <TD>
                    <Button variant="ghost" size="sm">
                      <Edit2 size={13} />
                      Редактировать
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
