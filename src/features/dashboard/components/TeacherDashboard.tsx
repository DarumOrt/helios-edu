"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  ClipboardCheck,
  Gauge,
  Users,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Button, Card, Avatar, Badge, Progress, DataState } from "@/shared/ui";
import { RoleHero } from "./RoleHero";
import { Widget } from "./Widget";
import { NotificationsWidget } from "./NotificationsWidget";
import { formatDateTime } from "@/shared/lib/format";
import type { SubmissionFull } from "@/features/submissions/api";
import type { LeaderboardEntry } from "@/shared/lib/tracking/types";
import type { CourseActivityStat } from "@/features/analytics/api";

const COURSE = "c-matan";

export function TeacherDashboard() {
  const { data: subs } = useSWR<{ items: SubmissionFull[] }>("/api/submissions?status=submitted", fetcher);
  const { data: lb } = useSWR<{ entries: LeaderboardEntry[] }>(
    `/api/hub/leaderboard?courseId=${COURSE}`,
    fetcher,
    { refreshInterval: 5000 }
  );
  const { data: cs } = useSWR<{ activities: CourseActivityStat[] }>(
    `/api/analytics/course/${COURSE}`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const pending = subs?.items ?? [];
  const entries = lb?.entries ?? [];
  const avgProgress = entries.length
    ? Math.round(entries.reduce((s, e) => s + e.avgCoverage, 0) / entries.length)
    : 0;
  const active = entries.filter((e) => e.avgCoverage > 0).length;
  const lagging = entries.filter((e) => e.avgCoverage < 50);

  return (
    <div className="space-y-6">
      <RoleHero
        kicker="ИНЭК · группа М1217"
        title="Кабинет преподавателя"
        subtitle="Контроль изучения материалов, проверка работ и аналитика вовлечённости группы."
        actions={
          <>
            <Link href="/submissions">
              <Button className="bg-white text-blue-700 hover:bg-white/90">
                <ClipboardCheck size={16} /> Проверить работы
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="ghost" className="text-white hover:bg-white/10">
                <BarChart3 size={16} /> Аналитика групп
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ClipboardCheck} tone="bg-warning-soft text-warning" label="На проверке" value={pending.length} />
        <StatCard icon={Gauge} tone="bg-primary-soft text-primary" label="Средний прогресс группы" value={`${avgProgress}%`} />
        <StatCard icon={Users} tone="bg-success-soft text-success" label="Приступили" value={`${active}/${entries.length}`} />
        <StatCard icon={AlertTriangle} tone="bg-danger-soft text-danger" label="Отстают" value={lagging.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Очередь проверки */}
        <Widget
          title="Требует проверки"
          subtitle={`${pending.length} работ ожидают оценки`}
          icon={ClipboardCheck}
          action={
            <Link href="/submissions" className="text-xs text-primary hover:underline">
              Все
            </Link>
          }
        >
          <DataState empty={!pending.length} emptyTitle="Всё проверено">
            <ul className="space-y-2.5">
              {pending.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link
                    href="/submissions"
                    className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-muted/60 transition"
                  >
                    <Avatar name={s.userName} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.userName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{s.assignmentTitle}</div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDateTime(s.submittedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </DataState>
        </Widget>

        {/* Отстающие */}
        <Widget
          title="Отстающие студенты"
          subtitle="Покрытие материалов < 50%"
          icon={AlertTriangle}
          action={
            <Link href="/hub" className="text-xs text-primary hover:underline">
              Мониторинг
            </Link>
          }
        >
          <DataState empty={!lagging.length} emptyTitle="Отстающих нет">
            <ul className="space-y-2.5">
              {lagging.slice(0, 5).map((e) => (
                <li key={e.userId} className="flex items-center gap-3">
                  <Avatar name={e.userName} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.userName}</div>
                    <Progress value={e.avgCoverage} tone="warning" className="mt-1" />
                  </div>
                  <Badge tone={e.avgCoverage < 30 ? "danger" : "warning"}>{e.avgCoverage}%</Badge>
                </li>
              ))}
            </ul>
          </DataState>
        </Widget>

        <NotificationsWidget />
      </div>

      {/* Прогресс по материалам */}
      <Widget
        title="Прогресс группы по материалам"
        subtitle="Математический анализ · средн. покрытие по каждому материалу"
        icon={BarChart3}
        action={
          <Link href={`/courses/${COURSE}`} className="text-xs text-primary hover:underline flex items-center gap-1">
            Детально <ChevronRight size={13} />
          </Link>
        }
      >
        <DataState empty={!cs?.activities?.length}>
          <div className="space-y-3">
            {cs?.activities.map((a) => (
              <div key={a.activityId} className="flex items-center gap-3">
                <div className="w-48 shrink-0 text-sm truncate">{a.title}</div>
                <Progress
                  value={a.avgCoverage}
                  tone={a.avgCoverage >= 70 ? "success" : "primary"}
                  className="flex-1"
                />
                <div className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {a.completed}/{a.total} изучили
                </div>
                <div className="w-10 shrink-0 text-right text-sm font-medium tabular-nums">
                  {a.avgCoverage}%
                </div>
              </div>
            ))}
          </div>
        </DataState>
      </Widget>
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="p-4 hover:shadow-elevate transition">
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
