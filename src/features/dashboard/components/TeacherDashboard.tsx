"use client";

import Link from "next/link";
import useSWR from "swr";
import { ClipboardCheck, AlertTriangle, BarChart3, ChevronRight } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { useSession } from "@/shared/auth/session";
import { Button, Avatar, Badge, Progress, DataState } from "@/shared/ui";
import { RoleHero } from "./RoleHero";
import { FactStrip } from "./FactStrip";
import { Widget } from "./Widget";
import { NotificationsWidget } from "./NotificationsWidget";
import { formatDateTime } from "@/shared/lib/format";
import type { SubmissionFull } from "@/features/submissions/api";
import type { LeaderboardEntry } from "@/shared/lib/tracking/types";
import type { CourseActivityStat } from "@/features/analytics/api";

export function TeacherDashboard() {
  const user = useSession((s) => s.user);
  const { data: subs } = useSWR<{ items: SubmissionFull[] }>("/api/submissions?status=submitted", fetcher);
  // первый из курсов преподавателя — по нему прогресс группы на дашборде
  const { data: myCourses } = useSWR<{ id: string }[]>("/api/courses", fetcher);
  const COURSE = myCourses?.[0]?.id;
  const { data: lb } = useSWR<{ entries: LeaderboardEntry[] }>(
    COURSE ? `/api/hub/leaderboard?courseId=${COURSE}` : null,
    fetcher,
    { refreshInterval: 5000 },
  );
  const { data: cs } = useSWR<{ activities: CourseActivityStat[] }>(
    COURSE ? `/api/analytics/course/${COURSE}` : null,
    fetcher,
    { refreshInterval: 5000 },
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
        name={user.name.split(" ")[0]}
        subtitle={
          pending.length
            ? `${pending.length} ${pending.length === 1 ? "работа ждёт" : "работы ждут"} проверки. Начнём с них?`
            : "Все работы проверены — можно заглянуть в аналитику группы."
        }
        actions={
          <>
            <Link href="/submissions">
              <Button>
                <ClipboardCheck size={16} /> Проверить работы
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="outline">
                <BarChart3 size={16} /> Аналитика групп
              </Button>
            </Link>
          </>
        }
      />

      <FactStrip
        facts={[
          {
            label: "На проверке",
            value: pending.length,
            tone: pending.length ? "warning" : "default",
            href: "/submissions",
          },
          { label: "Средний прогресс группы", value: `${avgProgress}%` },
          { label: "Приступили", value: `${active}/${entries.length}` },
          {
            label: "Отстают",
            value: lagging.length,
            tone: lagging.length ? "danger" : "default",
            href: "/hub",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                    className="-mx-2 flex items-center gap-3 rounded-md p-2 transition hover:bg-muted/60"
                  >
                    <Avatar name={s.userName} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.userName}</div>
                      <div className="truncate text-xs text-muted-foreground">{s.assignmentTitle}</div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
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
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.userName}</div>
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
          <Link
            href={`/courses/${COURSE}`}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Детально <ChevronRight size={13} />
          </Link>
        }
      >
        <DataState empty={!cs?.activities?.length}>
          <div className="space-y-3">
            {cs?.activities.map((a) => (
              <div key={a.activityId} className="flex items-center gap-3">
                <div className="w-48 shrink-0 truncate text-sm">{a.title}</div>
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
