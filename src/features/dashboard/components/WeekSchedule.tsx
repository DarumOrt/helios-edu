"use client";

import Link from "next/link";
import useSWR from "swr";
import { CalendarDays } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { useDayPart } from "@/shared/lib/use-day-part";
import { useSession } from "@/shared/auth/session";
import { Badge, DataState, Disclosure } from "@/shared/ui";
import type { PairTime, ScheduleSlot } from "@/shared/types/domain";

interface Slot extends ScheduleSlot {
  course: { id: string; title: string } | null;
}

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const KIND = { lecture: "Лекция", practice: "Практика", seminar: "Семинар" };

function minutes(time: string) {
  const [hour, min] = time.split(":").map(Number);
  return hour * 60 + min;
}

export function WeekSchedule() {
  const group = useSession((s) => s.user.group);
  const day = useDayPart();
  const { data, error, isLoading } = useSWR<{ pairs: PairTime[]; slots: Slot[] }>(
    group ? `/api/schedule?group=${encodeURIComponent(group)}` : null,
    fetcher,
  );
  if (!group) return null;

  const pairs = new Map(data?.pairs.map((pair) => [pair.n, pair]));
  const slots = (data?.slots ?? []).toSorted((a, b) => a.pair - b.pair);
  const weekdays = DAYS.map((name, i) => ({
    name,
    weekday: i + 1,
    slots: slots.filter((slot) => slot.weekday === i + 1),
  })).filter((entry) => entry.slots.length);
  const today = weekdays.find((entry) => entry.weekday === day?.weekday);
  const ordered = today ? [today, ...weekdays.filter((entry) => entry !== today)] : weekdays;

  return (
    <Disclosure title="Расписание" icon={<CalendarDays size={17} />} meta={group}>
      <DataState
        loading={isLoading}
        error={error}
        empty={!ordered.length}
        emptyTitle="На этой неделе пар нет"
      >
        <div className="divide-y">
          {ordered.map((entry) => (
            <section key={entry.weekday} className="py-2">
              <h3 className="text-xs font-semibold text-muted-foreground">
                {entry === today ? "Сегодня" : entry.name}
              </h3>
              <ul className="mt-1 space-y-1.5">
                {entry.slots.map((slot) => {
                  const pair = pairs.get(slot.pair);
                  const active =
                    day?.weekday === entry.weekday &&
                    pair &&
                    day.minutes >= minutes(pair.start) &&
                    day.minutes <= minutes(pair.end);
                  const details = (
                    <>
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                        {pair?.start ?? `Пара ${slot.pair}`}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm leading-snug font-medium">
                          {slot.course?.title ?? "Занятие"}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {KIND[slot.kind]}
                          {slot.room ? `, ${slot.room}` : ""}
                        </span>
                        {active && (
                          <Badge tone="warning" className="mt-1">
                            Идёт сейчас
                          </Badge>
                        )}
                      </span>
                    </>
                  );
                  const rowClass =
                    "grid grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-2 rounded-md px-1 py-1.5";
                  return (
                    <li key={slot.id}>
                      {slot.course ? (
                        <Link
                          className={`${rowClass} hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden`}
                          href={`/courses/${slot.course.id}`}
                        >
                          {details}
                        </Link>
                      ) : (
                        <div className={rowClass}>{details}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </DataState>
    </Disclosure>
  );
}
