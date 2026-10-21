"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { CalendarClock, FileText, ClipboardCheck } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { DataState, Badge } from "@/shared/ui";
import { Widget } from "./Widget";
import { formatDate } from "@/shared/lib/format";
import type { Course, Activity } from "@/shared/types/domain";

interface DeadlineItem {
  course: string;
  activity: Activity;
}

export function UpcomingDeadlines() {
  // фиксируем "сейчас" один раз: Date.now() в рендере нечист и ломает гидратацию
  const [now] = useState(() => Date.now());
  const { data, error, isLoading } = useSWR<Course[]>("/api/courses?sections=1", fetcher);

  const items: DeadlineItem[] = (data ?? [])
    .flatMap((c) =>
      (c.sections ?? [])
        .flatMap((s) => s.activities)
        .filter((a) => a.due && !a.completed)
        .map((a) => ({ course: c.title, activity: a })),
    )
    .sort((a, b) => (a.activity.due ?? "").localeCompare(b.activity.due ?? ""));

  return (
    <Widget title="Сдать" icon={CalendarClock}>
      <DataState loading={isLoading} error={error} empty={!items.length} emptyTitle="Сдавать пока нечего">
        <ul className="-my-1 divide-y">
          {items.slice(0, 3).map(({ course, activity }) => {
            const Icon = activity.type === "quiz" ? ClipboardCheck : FileText;
            const daysLeft = activity.due
              ? Math.ceil((new Date(activity.due).getTime() - now) / 86400000)
              : null;
            const overdue = daysLeft != null && daysLeft < 0;
            const tone =
              overdue || (daysLeft != null && daysLeft <= 3)
                ? "danger"
                : daysLeft != null && daysLeft <= 7
                  ? "warning"
                  : "neutral";
            const when = overdue
              ? "просрочено"
              : daysLeft === 0
                ? "сегодня"
                : daysLeft != null && daysLeft <= 7
                  ? `через ${daysLeft} дн`
                  : null;
            return (
              <li key={`${course}-${activity.id}`} className="flex gap-3 py-2.5">
                <Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm leading-snug font-medium">{activity.title}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{course}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {when && <Badge tone={tone as "danger" | "warning" | "neutral"}>{when}</Badge>}
                    <span className="font-mono text-xs text-muted-foreground">
                      до {formatDate(activity.due)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {items.length > 3 && (
          <Link href="/courses" className="mt-3 inline-block text-sm text-primary hover:underline">
            Ещё {items.length - 3} — все задания
          </Link>
        )}
      </DataState>
    </Widget>
  );
}
