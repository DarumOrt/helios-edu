"use client";

import Link from "next/link";
import useSWR from "swr";
import { CalendarDays } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/utils";
import { useDayPart } from "@/shared/lib/use-day-part";
import { COVER_COLORS, fallbackCoverColor, type CoverColor } from "@/shared/lib/cover-colors";
import { useSessionStore } from "@/stores/session-store";
import { DataState } from "@/shared/ui";
import type { PairTime, ScheduleSlot } from "@/shared/types/domain";
import { Widget } from "./Widget";

interface Slot extends ScheduleSlot {
  course: { id: string; code: string; title: string; coverColor?: CoverColor } | null;
}

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт"];
const kindLabel: Record<ScheduleSlot["kind"], string> = {
  lecture: "лекция",
  practice: "практика",
  seminar: "семинар",
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Неделя по парам: студент живёт расписанием, а не списком задач. Цвет пары — цвет обложки курса. */
export function WeekSchedule() {
  const user = useSessionStore((s) => s.user);
  const day = useDayPart();
  const { data, error, isLoading } = useSWR<{ pairs: PairTime[]; slots: Slot[] }>(
    user.group ? `/api/schedule?group=${encodeURIComponent(user.group)}` : null,
    fetcher,
  );
  const pairs = data?.pairs ?? [];
  const slots = data?.slots ?? [];
  const usedPairs = pairs.filter((p) => slots.some((s) => s.pair === p.n));

  return (
    <Widget
      title="Неделя"
      subtitle={user.group ? `Расписание группы ${user.group}` : undefined}
      icon={CalendarDays}
    >
      <DataState loading={isLoading} error={error} empty={!slots.length} emptyTitle="Пар на этой неделе нет">
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="grid min-w-[520px] grid-cols-[56px_repeat(5,minmax(0,1fr))] gap-1.5">
            <div />
            {DAYS.map((d, i) => (
              <div
                key={d}
                className={cn(
                  "rounded-lg py-1 text-center text-xs font-medium",
                  day?.weekday === i + 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {d}
              </div>
            ))}
            {usedPairs.map((p) => (
              <Row key={p.n} pair={p} slots={slots} today={day?.weekday} minutes={day?.minutes} />
            ))}
          </div>
        </div>
      </DataState>
    </Widget>
  );
}

function Row({
  pair,
  slots,
  today,
  minutes,
}: {
  pair: PairTime;
  slots: Slot[];
  today?: number;
  minutes?: number;
}) {
  const live = minutes != null && minutes >= toMin(pair.start) && minutes <= toMin(pair.end);
  return (
    <>
      <div className="pt-1.5 font-mono text-xs leading-tight text-muted-foreground">
        {pair.n} пара
        <br />
        {pair.start}
      </div>
      {DAYS.map((_, i) => {
        const s = slots.find((x) => x.weekday === i + 1 && x.pair === pair.n);
        const isToday = today === i + 1;
        if (!s?.course) {
          return (
            <div
              key={i}
              className={cn("min-h-14 rounded-lg", isToday ? "bg-primary-soft/60" : "bg-muted/50")}
            />
          );
        }
        const color = COVER_COLORS[s.course.coverColor ?? fallbackCoverColor(s.course.id)];
        const now = isToday && live;
        return (
          <Link
            key={i}
            href={`/courses/${s.course.id}`}
            title={`${s.course.title}, ${kindLabel[s.kind]}, ${s.room}`}
            className={cn(
              "relative min-h-14 overflow-hidden rounded-lg bg-card py-1.5 pr-1.5 pl-2.5 text-xs leading-tight shadow-soft ring-1 ring-border transition-transform duration-150 ease-out hover:-translate-y-0.5",
              now && "ring-2 ring-sun",
            )}
          >
            <span
              className="absolute inset-y-0 left-0 w-1"
              style={{ backgroundColor: color.bg }}
              aria-hidden
            />
            <span className="block truncate font-medium">{s.course.title}</span>
            <span className="block truncate text-muted-foreground">
              {now ? "идёт сейчас" : kindLabel[s.kind]} · {s.room}
            </span>
          </Link>
        );
      })}
    </>
  );
}
