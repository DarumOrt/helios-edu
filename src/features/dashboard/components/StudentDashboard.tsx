"use client";

import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { useSession } from "@/shared/auth/session";
import Link from "next/link";
import { Flame, Star, Trophy } from "lucide-react";
import { Button } from "@/shared/ui";
import type { Course, Notification } from "@/shared/types/domain";
import type { LeaderboardEntry } from "@/shared/lib/tracking/types";
import { RoleHero, HeroChip } from "./RoleHero";
import { FactStrip } from "./FactStrip";
import { NextStep } from "./NextStep";
import { MyCoursesWidget } from "./MyCoursesWidget";
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { NotificationsWidget } from "./NotificationsWidget";
import { WeekSchedule } from "./WeekSchedule";
import { Classmates } from "./Classmates";

export function StudentDashboard() {
  const user = useSession((s) => s.user);
  const { data: courses } = useSWR<Course[]>("/api/courses?sections=1", fetcher);
  const { data: notifs } = useSWR<Notification[]>("/api/notifications", fetcher);

  const avgProgress = courses?.length
    ? Math.round(courses.reduce((a, c) => a + (c.progress ?? 0), 0) / courses.length)
    : 0;
  const openTasks =
    courses
      ?.flatMap((c) => (c.sections ?? []).flatMap((s) => s.activities))
      .filter((a) => a.due && !a.completed).length ?? 0;
  const unread = notifs?.filter((n) => !n.read).length ?? 0;
  const { data: lb } = useSWR<{ entries: LeaderboardEntry[] }>(
    courses?.[0] ? `/api/hub/leaderboard?courseId=${courses[0].id}&userId=${user.id}` : null,
    fetcher,
  );
  const me = lb?.entries.find((e) => e.isCurrentUser);
  // Курс, который ближе всего к финишу, — повод для мотивирующей фразы
  const closest = courses
    ?.filter((c) => (c.progress ?? 0) < 100)
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0];

  return (
    <div className="space-y-6">
      <RoleHero
        name={user.name.split(" ")[0]}
        subtitle={
          closest ? (
            <>
              «{closest.title}» пройден на {closest.progress}% — ещё немного, и курс закрыт.
            </>
          ) : (
            "Все курсы пройдены. Отличная работа!"
          )
        }
        chips={
          <>
            {me && me.streak > 0 && (
              <HeroChip icon={Flame} tone="sun">
                {me.streak} {me.streak === 1 ? "день" : me.streak < 5 ? "дня" : "дней"} подряд
              </HeroChip>
            )}
            {me && <HeroChip icon={Star}>{me.score} баллов в группе</HeroChip>}
            <HeroChip>{avgProgress}% пройдено в среднем</HeroChip>
          </>
        }
        actions={
          <Link href="/hub">
            <Button variant="outline">
              <Trophy size={16} /> Хаб группы
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NextStep />
        </div>
        <UpcomingDeadlines />
      </div>

      <FactStrip
        facts={[
          { label: "Курсов", value: courses?.length ?? 0, href: "/courses" },
          { label: "Пройдено в среднем", value: `${avgProgress}%` },
          { label: "Заданий к сдаче", value: openTasks, tone: openTasks ? "warning" : "default" },
          { label: "Новых уведомлений", value: unread },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <WeekSchedule />
        </div>
        <Classmates />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MyCoursesWidget />
        <NotificationsWidget />
      </div>
    </div>
  );
}
