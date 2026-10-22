"use client";

import useSWR from "swr";
import { Users, Gauge, AlertTriangle, CircleDashed, CheckCircle2 } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Card, DataState, Table, THead, TR, TH, TD, Avatar, Badge, Progress } from "@/shared/ui";
import type { LeaderboardEntry } from "@/shared/lib/tracking/types";

interface Resp {
  entries: LeaderboardEntry[];
}

export function GroupMonitor({ courseId }: { courseId: string }) {
  const { data, error, isLoading } = useSWR<Resp>(`/api/hub/leaderboard?courseId=${courseId}`, fetcher, {
    refreshInterval: 5000,
  });

  const entries = data?.entries ?? [];
  const total = entries.length;
  const avg = total ? Math.round(entries.reduce((s, e) => s + e.avgCoverage, 0) / total) : 0;
  const notStarted = entries.filter((e) => e.avgCoverage === 0).length;
  const lagging = entries.filter((e) => e.avgCoverage > 0 && e.avgCoverage < 50).length;
  const done = entries.filter((e) => e.materialsCompleted === e.materialsTotal).length;

  // худшие сверху — фокус на тех, кому нужна помощь
  const sorted = [...entries].sort((a, b) => a.avgCoverage - b.avgCoverage);

  function risk(e: LeaderboardEntry) {
    if (e.avgCoverage === 0) return { label: "не начал", tone: "danger" as const, icon: CircleDashed };
    if (e.avgCoverage < 50) return { label: "отстаёт", tone: "warning" as const, icon: AlertTriangle };
    if (e.materialsCompleted === e.materialsTotal)
      return { label: "всё изучил", tone: "success" as const, icon: CheckCircle2 };
    return { label: "в норме", tone: "info" as const, icon: Gauge };
  }

  return (
    <DataState loading={isLoading} error={error} empty={!entries.length}>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini icon={Gauge} tone="bg-primary-soft text-primary" label="Средний прогресс" value={`${avg}%`} />
        <Mini
          icon={CheckCircle2}
          tone="bg-success-soft text-success"
          label="Прошли всё"
          value={`${done}/${total}`}
        />
        <Mini icon={AlertTriangle} tone="bg-warning-soft text-warning" label="Отстают" value={lagging} />
        <Mini icon={CircleDashed} tone="bg-danger-soft text-danger" label="Не начали" value={notStarted} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm">
          <Users size={15} className="text-muted-foreground" />
          <span className="font-medium">Студенты курса</span>
          <span className="text-xs text-muted-foreground">— сначала те, кому нужна помощь</span>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Студент</TH>
              <TH>Покрытие материалов</TH>
              <TH>Материалов</TH>
              <TH>Тест</TH>
              <TH>Статус</TH>
            </TR>
          </THead>
          <tbody>
            {sorted.map((e) => {
              const r = risk(e);
              const RIcon = r.icon;
              return (
                <TR key={e.userId}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={e.userName} size={28} />
                      <span className="font-medium">{e.userName}</span>
                    </div>
                  </TD>
                  <TD>
                    <div className="flex min-w-[140px] items-center gap-2">
                      <Progress
                        value={e.avgCoverage}
                        tone={e.avgCoverage >= 70 ? "success" : e.avgCoverage >= 40 ? "primary" : "warning"}
                        className="flex-1"
                      />
                      <span className="w-9 text-right text-xs tabular-nums">{e.avgCoverage}%</span>
                    </div>
                  </TD>
                  <TD className="tabular-nums">
                    {e.materialsCompleted}/{e.materialsTotal}
                  </TD>
                  <TD>
                    {e.quizAvg != null ? (
                      <span className="tabular-nums">{e.quizAvg}%</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={r.tone}>
                      <RIcon size={11} />
                      {r.label}
                    </Badge>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </DataState>
  );
}

function Mini({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof Gauge;
  tone: string;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">{label}</div>
          <div className="text-xl leading-tight font-semibold">{value}</div>
        </div>
      </div>
    </Card>
  );
}
