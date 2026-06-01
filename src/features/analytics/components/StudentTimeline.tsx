"use client";

import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { Skeleton } from "@/shared/ui";
import { fmtDuration } from "@/shared/lib/format";
import type { LessonStatsResponse } from "../api";
import type { TrackingVerb } from "@/shared/lib/tracking/types";

const verbLabel: Record<TrackingVerb, string> = {
  opened: "открыл материал",
  played: "запустил",
  paused: "пауза",
  seeked: "перемотка",
  ratechanged: "сменил скорость",
  heartbeat: "просмотр",
  page_viewed: "открыл страницу",
  completed: "завершил",
  closed: "закрыл",
};

const verbColor: Record<string, string> = {
  opened: "bg-slate-300",
  played: "bg-success",
  paused: "bg-warning",
  seeked: "bg-danger",
  ratechanged: "bg-violet-400",
  heartbeat: "bg-primary/40",
  page_viewed: "bg-primary",
  completed: "bg-success",
  closed: "bg-slate-400",
};

export function StudentTimeline({ activityId, userId }: { activityId: string; userId: string }) {
  const { data, isLoading } = useSWR<LessonStatsResponse>(
    `/api/analytics/lesson/${activityId}?userId=${userId}`,
    fetcher
  );

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const events = (data?.events ?? []).filter((e) => e.verb !== "heartbeat");

  if (!events.length) {
    return (
      <div className="text-sm text-muted-foreground py-4 px-2">
        Нет детальных событий. Откройте материал под этим студентом, чтобы записать таймлайн.
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="text-xs font-medium text-muted-foreground mb-3">Таймлайн действий</div>
      <ol className="relative border-l border-border ml-2 space-y-3">
        {events.map((e) => (
          <li key={e.id} className="ml-4">
            <span
              className={`absolute -left-[5px] w-2.5 h-2.5 rounded-full ${verbColor[e.verb] ?? "bg-slate-300"}`}
            />
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{verbLabel[e.verb]}</span>
              {e.position != null && e.activityType === "video" && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  на {fmtDuration(e.position)}
                </span>
              )}
              {e.position != null && e.activityType !== "video" && (
                <span className="text-xs text-muted-foreground">стр. {Number(e.position) + 1}</span>
              )}
              {e.payload?.rate != null && (
                <span className="text-xs text-muted-foreground">×{String(e.payload.rate)}</span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {new Date(e.ts).toLocaleTimeString("ru-RU")}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
