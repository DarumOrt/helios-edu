"use client";

import { useState } from "react";
import useSWR from "swr";
import { ChevronDown, BarChart3, CheckCircle2, Clock, CircleDashed } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Card, CardHeader, DataState, Table, THead, TR, TH, TD, Avatar, Badge, Progress } from "@/shared/ui";
import { fmtDuration, timeAgo } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { StudentTimeline } from "./StudentTimeline";
import type { LessonStatsResponse } from "../api";
import type { LessonStatRow } from "@/shared/lib/tracking/types";

const statusMeta = {
  completed: { label: "Изучил", tone: "success" as const, icon: CheckCircle2 },
  in_progress: { label: "В процессе", tone: "warning" as const, icon: Clock },
  not_started: { label: "Не начал", tone: "neutral" as const, icon: CircleDashed },
};

export function LessonStatsPanel({ activityId, title }: { activityId: string; title: string }) {
  const { data, error, isLoading } = useSWR<LessonStatsResponse>(
    `/api/analytics/lesson/${activityId}`,
    fetcher,
    { refreshInterval: 5000 }
  );
  const [openUser, setOpenUser] = useState<string | null>(null);

  const rows = data?.rows ?? [];
  const completed = rows.filter((r) => r.completed).length;
  const started = rows.filter((r) => r.status !== "not_started").length;

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={`${completed} изучили · ${started} начали · ${rows.length} в группе`}
        icon={<BarChart3 size={18} />}
        action={<Badge tone="info">обновляется live</Badge>}
      />
      <DataState loading={isLoading} error={error} empty={!rows.length}>
        <Table>
          <THead>
            <TR>
              <TH>Студент</TH>
              <TH>Статус</TH>
              <TH>Покрытие</TH>
              <TH>Активное время</TH>
              <TH>Детали</TH>
              <TH>Последняя активность</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((r) => {
              const meta = statusMeta[r.status];
              const open = openUser === r.userId;
              return (
                <RowWithDetail
                  key={r.userId}
                  row={r}
                  open={open}
                  meta={meta}
                  activityId={activityId}
                  onToggle={() => setOpenUser(open ? null : r.userId)}
                />
              );
            })}
          </tbody>
        </Table>
      </DataState>
    </Card>
  );
}

function RowWithDetail({
  row,
  open,
  meta,
  activityId,
  onToggle,
}: {
  row: LessonStatRow;
  open: boolean;
  meta: (typeof statusMeta)[keyof typeof statusMeta];
  activityId: string;
  onToggle: () => void;
}) {
  const Icon = meta.icon;
  return (
    <>
      <TR>
        <TD>
          <div className="flex items-center gap-2.5">
            <Avatar name={row.userName} size={28} />
            <span className="font-medium">{row.userName}</span>
          </div>
        </TD>
        <TD>
          <Badge tone={meta.tone}>
            <Icon size={11} />
            {meta.label}
          </Badge>
        </TD>
        <TD>
          <div className="flex items-center gap-2 min-w-[120px]">
            <Progress
              value={row.coverage}
              tone={row.coverage >= 80 ? "success" : "primary"}
              className="flex-1"
            />
            <span className="text-xs tabular-nums w-9 text-right">{row.coverage}%</span>
          </div>
        </TD>
        <TD className="tabular-nums">{fmtDuration(row.activeTimeSec)}</TD>
        <TD className="text-xs text-muted-foreground">
          {row.totalPages != null
            ? `${row.pagesViewed ?? 0}/${row.totalPages} стр.`
            : row.seeks != null
            ? `${row.seeks} перемоток`
            : "—"}
        </TD>
        <TD className="text-xs text-muted-foreground">{timeAgo(row.lastAt)}</TD>
        <TD>
          <button
            onClick={onToggle}
            disabled={row.status === "not_started"}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
          >
            <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
          </button>
        </TD>
      </TR>
      {open && (
        <tr className="bg-muted/20">
          <td colSpan={7} className="px-4">
            <StudentTimeline activityId={activityId} userId={row.userId} />
          </td>
        </tr>
      )}
    </>
  );
}
