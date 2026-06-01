"use client";

import useSWR from "swr";
import { Users, Gauge, AlertTriangle, CircleDashed, CheckCircle2 } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Card, CardBody, DataState, Table, THead, TR, TH, TD, Avatar, Badge, Progress } from "@/shared/ui";
import type { LeaderboardEntry } from "@/shared/lib/tracking/types";

interface Resp {
  entries: LeaderboardEntry[];
}

export function GroupMonitor({ courseId }: { courseId: string }) {
  const { data, error, isLoading } = useSWR<Resp>(
    `/api/hub/leaderboard?courseId=${courseId}`,
    fetcher,
    { refreshInterval: 5000 }
  );

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
    if (e.materialsCompleted === e.materialsTotal) return { label: "всё изучил", tone: "success" as const, icon: CheckCircle2 };
    return { label: "в норме", tone: "info" as const, icon: Gauge };
  }

  return (
    <DataState loading={isLoading} error={error} empty={!entries.length}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Mini icon={Gauge} tone="bg-primary-soft text-primary" label="Средний прогресс" value={`${avg}%`} />
        <Mini icon={CheckCircle2} tone="bg-success-soft text-success" label="Прошли всё" value={`${done}/${total}`} />
        <Mini icon={AlertTriangle} tone="bg-warning-soft text-warning" label="Отстают" value={lagging} />
        <Mini icon={CircleDashed} tone="bg-danger-soft text-danger" label="Не начали" value={notStarted} />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b flex items-center gap-2 text-sm">
          <Users size={15} className="text-muted-foreground" />
          <span className="font-medium">Группа М1217</span>
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
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <Progress
                        value={e.avgCoverage}
                        tone={e.avgCoverage >= 70 ? "success" : e.avgCoverage >= 40 ? "primary" : "warning"}
                        className="flex-1"
                      />
                      <span className="text-xs tabular-nums w-9 text-right">{e.avgCoverage}%</span>
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
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-xl font-semibold leading-tight">{value}</div>
        </div>
      </div>
    </Card>
  );
}
