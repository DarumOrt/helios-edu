"use client";

import Link from "next/link";
import { BookOpen, Trophy } from "lucide-react";
import { Button } from "@/shared/ui";
import { useSessionStore } from "@/stores/session-store";
import { RoleHero } from "./RoleHero";
import { StatsRow } from "./StatsRow";
import { MyCoursesWidget } from "./MyCoursesWidget";
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { NotificationsWidget } from "./NotificationsWidget";

export function StudentDashboard() {
  const user = useSessionStore((s) => s.user);
  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  return (
    <div className="space-y-6">
      <RoleHero
        kicker={`${user.faculty}${user.group ? ` · группа ${user.group}` : ""}`}
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        subtitle="Продолжите обучение там, где остановились. Сегодня открыто несколько активностей."
        actions={
          <>
            <Link href="/courses">
              <Button className="bg-white text-emerald-700 hover:bg-white/90">
                <BookOpen size={16} /> К курсам
              </Button>
            </Link>
            <Link href="/hub">
              <Button variant="ghost" className="text-white hover:bg-white/10">
                <Trophy size={16} /> Хаб группы
              </Button>
            </Link>
          </>
        }
      />
      <StatsRow />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MyCoursesWidget />
        <UpcomingDeadlines />
        <NotificationsWidget />
      </div>
    </div>
  );
}
