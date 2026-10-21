"use client";

import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { Card } from "@/shared/ui";
import { BookOpen, CheckCircle2, Clock, Trophy, type LucideIcon } from "lucide-react";
import type { Course, Notification } from "@/shared/types/domain";

interface Stat {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "accent";
}

const toneClasses: Record<Stat["tone"], string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  accent: "bg-violet-50 text-violet-600",
};

export function StatsRow() {
  const { data: courses } = useSWR<Course[]>("/api/courses", fetcher);
  const { data: notifs } = useSWR<Notification[]>("/api/notifications", fetcher);

  const totalCourses = courses?.length ?? 0;
  const completed = courses?.filter((c) => (c.progress ?? 0) >= 100).length ?? 0;
  const deadlines = notifs?.filter((n) => n.type === "deadline" && !n.read).length ?? 0;
  const avgProgress =
    courses && courses.length
      ? Math.round(courses.reduce((a, c) => a + (c.progress ?? 0), 0) / courses.length)
      : 0;

  const stats: Stat[] = [
    { label: "Активных курсов", value: totalCourses, icon: BookOpen, tone: "primary" },
    { label: "Завершено", value: completed, icon: CheckCircle2, tone: "success" },
    { label: "Скоро дедлайн", value: deadlines, icon: Clock, tone: "warning" },
    { label: "Средний прогресс", value: `${avgProgress}%`, icon: Trophy, tone: "accent" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <Card key={s.label} className="p-4 transition hover:shadow-elevate">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses[s.tone]}`}>
                <Icon size={18} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-xl leading-tight font-semibold">{s.value}</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
