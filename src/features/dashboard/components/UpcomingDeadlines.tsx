"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronDown } from "lucide-react";
import { activityHref } from "@/shared/lib/activity-href";
import { pendingDeadlines } from "@/shared/lib/learning-progress";
import { DataState, Badge, Disclosure } from "@/shared/ui";
import { formatDate, pluralCount } from "@/shared/lib/format";
import type { Course } from "@/shared/types/domain";

export function UpcomingDeadlines({
  courses,
  loading,
  error,
}: {
  courses?: Course[];
  loading: boolean;
  error: unknown;
}) {
  const [now] = useState(() => new Date());
  const items = pendingDeadlines(courses ?? []);

  return (
    <Disclosure
      title="К сдаче"
      icon={<CalendarClock size={17} />}
      defaultOpen
      meta={courses && pluralCount(items.length, "срок", "срока", "сроков")}
    >
      <DataState loading={loading} error={error} empty={!items.length} emptyTitle="Сдавать пока нечего">
        <DeadlineList items={items.slice(0, 3)} now={now} />
        {items.length > 3 && (
          <details className="group/more border-t">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-md px-1 text-sm font-medium text-primary hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
              Ещё {pluralCount(items.length - 3, "срок", "срока", "сроков")}
              <ChevronDown
                size={15}
                aria-hidden
                className="group-open/more:rotate-180 motion-safe:transition-transform"
              />
            </summary>
            <DeadlineList items={items.slice(3)} now={now} />
          </details>
        )}
      </DataState>
    </Disclosure>
  );
}

function DeadlineList({ items, now }: { items: ReturnType<typeof pendingDeadlines>; now: Date }) {
  return (
    <ul className="divide-y">
      {items.map(({ course, activity, due: date }) => {
        const due = new Date(date);
        const overdue = due.getTime() < now.getTime();
        const today = due.toDateString() === now.toDateString();
        return (
          <li key={`${course.id}/${activity.id}`}>
            <Link
              href={activityHref(course.id, activity)}
              className="flex items-start justify-between gap-2 rounded-md px-1 py-2.5 hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset"
            >
              <div className="min-w-0">
                <p className="text-sm leading-snug font-medium wrap-break-word">{activity.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{course.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">До {formatDate(date)}</p>
              </div>
              {overdue ? (
                <Badge tone="danger" className="shrink-0">
                  Срок прошёл
                </Badge>
              ) : today ? (
                <Badge tone="warning" className="shrink-0">
                  Сегодня
                </Badge>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
