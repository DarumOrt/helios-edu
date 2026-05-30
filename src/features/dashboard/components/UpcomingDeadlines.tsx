"use client";

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
  const { data, error, isLoading } = useSWR<Course[]>("/api/courses", fetcher);

  const items: DeadlineItem[] = (data ?? [])
    .flatMap((c) =>
      (c.sections ?? [])
        .flatMap((s) => s.activities)
        .filter((a) => a.due && !a.completed)
        .map((a) => ({ course: c.title, activity: a }))
    )
    .sort((a, b) => (a.activity.due ?? "").localeCompare(b.activity.due ?? ""));

  return (
    <Widget title="Дедлайны" subtitle="Ближайшие 5 задач" icon={CalendarClock}>
      <DataState loading={isLoading} error={error} empty={!items.length} emptyTitle="Нет дедлайнов">
        <ul className="space-y-2.5">
          {items.slice(0, 5).map(({ course, activity }) => {
            const Icon = activity.type === "quiz" ? ClipboardCheck : FileText;
            const daysLeft = activity.due
              ? Math.ceil((new Date(activity.due).getTime() - Date.now()) / 86400000)
              : null;
            const tone = daysLeft != null && daysLeft <= 3 ? "danger" : daysLeft != null && daysLeft <= 7 ? "warning" : "info";
            return (
              <li key={activity.id} className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-muted/60 transition">
                <div className="w-8 h-8 rounded-md bg-warning-soft text-warning flex items-center justify-center shrink-0">
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{activity.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{course}</div>
                </div>
                <Badge tone={tone as "danger" | "warning" | "info"}>{formatDate(activity.due)}</Badge>
              </li>
            );
          })}
        </ul>
      </DataState>
    </Widget>
  );
}
