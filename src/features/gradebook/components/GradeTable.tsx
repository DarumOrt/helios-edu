"use client";

import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { DataState, Table, THead, TR, TH, TD, Card, Avatar, Badge } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import type { GradeRow } from "@/shared/types/domain";

function gradeTone(grade: number | null, max: number): "success" | "info" | "warning" | "danger" | "neutral" {
  if (grade == null) return "neutral";
  const p = grade / max;
  if (p >= 0.85) return "success";
  if (p >= 0.7) return "info";
  if (p >= 0.5) return "warning";
  return "danger";
}

export function GradeTable({ courseId }: { courseId: string }) {
  const { data, error, isLoading } = useSWR<GradeRow[]>(
    `/api/gradebook?courseId=${courseId}`,
    fetcher
  );

  const items = data?.[0]?.items ?? [];

  return (
    <Card className="overflow-hidden">
      <DataState loading={isLoading} error={error} empty={!data?.length}>
        <Table>
          <THead>
            <TR>
              <TH>Студент</TH>
              {items.map((it) => (
                <TH key={it.itemId}>{it.itemTitle}</TH>
              ))}
              <TH>Итог</TH>
            </TR>
          </THead>
          <tbody>
            {data?.map((row) => (
              <TR key={row.userId}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.userName} size={28} />
                    <span className="font-medium">{row.userName}</span>
                  </div>
                </TD>
                {row.items.map((it) => (
                  <TD key={it.itemId}>
                    {it.grade == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge tone={gradeTone(it.grade, it.max)}>
                        {it.grade}/{it.max}
                      </Badge>
                    )}
                  </TD>
                ))}
                <TD>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      row.total >= 80
                        ? "text-success"
                        : row.total >= 60
                        ? "text-primary"
                        : row.total >= 40
                        ? "text-warning"
                        : "text-danger"
                    )}
                  >
                    {row.total.toFixed(1)}
                  </span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </DataState>
    </Card>
  );
}
