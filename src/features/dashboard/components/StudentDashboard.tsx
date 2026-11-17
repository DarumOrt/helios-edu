"use client";

import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { useSession } from "@/shared/auth/session";
import Link from "next/link";
import { BookCheck, Flame, Medal, Trophy } from "lucide-react";
import { Card, Progress, Skeleton } from "@/shared/ui";
import { materialProgress } from "@/shared/lib/learning-progress";
import { pluralCount } from "@/shared/lib/format";
import type { Course } from "@/shared/types/domain";
import type { LeaderboardEntry } from "@/shared/lib/tracking/types";
import { RoleHero } from "./RoleHero";
import { NextStep } from "./NextStep";
import { MyCoursesWidget } from "./MyCoursesWidget";
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { NotificationsWidget } from "./NotificationsWidget";
import { WeekSchedule } from "./WeekSchedule";
import { Classmates } from "./Classmates";
import { GradesWidget } from "./GradesWidget";

export function StudentDashboard() {
  const user = useSession((s) => s.user);
  const demo = useSession((s) => !s.backendEnabled);
  const { data: courses, error, isLoading } = useSWR<Course[]>("/api/courses?sections=1", fetcher);
  const { done, total, percent } = materialProgress(courses ?? []);
  const rankedCourse = courses?.[0];
  const { data: leaderboard } = useSWR<{ entries: LeaderboardEntry[] }>(
    rankedCourse
      ? `/api/hub/leaderboard?courseId=${encodeURIComponent(rankedCourse.id)}&userId=${encodeURIComponent(user.id)}`
      : null,
    fetcher,
  );
  const entries = leaderboard?.entries ?? [];
  const entry = entries.find((row) => row.isCurrentUser);
  const state = { courses, error, loading: isLoading };

  return (
    <div className="space-y-5 sm:space-y-6">
      <RoleHero
        name={user.name.split(" ")[0]}
        actions={<NextStep {...state} />}
        aside={
          isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : total > 0 ? (
            <Card className="min-w-0 border-border/60 bg-card/85 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <BookCheck size={16} className="text-primary" aria-hidden /> Мои материалы
                </span>
                <strong className="text-2xl leading-none font-semibold tabular-nums">{percent}%</strong>
              </div>
              <Progress
                value={percent}
                label="Доля завершённых материалов во всех курсах"
                className="mt-2.5"
                tone={done === total ? "success" : "primary"}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Завершено {done} из {total} во всех курсах
              </p>
            </Card>
          ) : undefined
        }
      />

      {entry && rankedCourse && (
        <Card className="border-border px-4 py-3 sm:px-5">
          <section
            aria-labelledby="student-rating-title"
            className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-center"
          >
            <div className="min-w-0">
              <h2 id="student-rating-title" className="text-sm font-semibold">
                {demo ? "Рейтинг в демо" : "Мой рейтинг"}
              </h2>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{rankedCourse.title}</p>
              <Link
                href="/hub"
                className="mt-1 inline-block text-xs font-medium text-primary underline-offset-3 hover:underline"
              >
                Открыть рейтинг
              </Link>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs sm:gap-3">
              <div className="min-w-0 rounded-lg bg-sun-soft px-2.5 py-2 text-warning">
                <dt className="flex items-center gap-1">
                  <Flame size={14} aria-hidden /> Серия
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums">
                  {pluralCount(entry.streak, "день", "дня", "дней")} подряд
                </dd>
              </div>
              <div className="min-w-0 rounded-lg bg-primary-soft px-2.5 py-2">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Trophy size={14} aria-hidden /> Баллы
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{entry.score} из 100</dd>
              </div>
              <div className="min-w-0 rounded-lg bg-muted px-2.5 py-2">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Medal size={14} aria-hidden /> Место
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums">
                  {entry.rank} из {entries.length}
                </dd>
              </div>
            </dl>
          </section>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <section aria-labelledby="student-learning" className="min-w-0 space-y-2.5">
          <h2 id="student-learning" className="px-0.5 text-lg font-semibold tracking-tight">
            Моя учёба
          </h2>
          <MyCoursesWidget {...state} />
          <GradesWidget />
          {user.group && <Classmates />}
        </section>
        <section aria-labelledby="student-agenda" className="min-w-0 space-y-2.5">
          <h2 id="student-agenda" className="px-0.5 text-lg font-semibold tracking-tight">
            Сегодня
          </h2>
          <UpcomingDeadlines {...state} />
          <WeekSchedule />
          <NotificationsWidget collapsible />
        </section>
      </div>
    </div>
  );
}
