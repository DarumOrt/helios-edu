"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { activityHref } from "@/shared/lib/activity-href";
import { Button, Card, CourseCover, Progress, Skeleton } from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import type { Activity, Course } from "@/shared/types/domain";
import type { ActivityProgress } from "@/shared/lib/tracking/types";

const TRACKED: Activity["type"][] = ["video", "pdf", "presentation"];

const typeLabel: Partial<Record<Activity["type"], string>> = {
  video: "Видеолекция",
  pdf: "Конспект",
  presentation: "Презентация",
  quiz: "Тест",
  assignment: "Задание",
};

interface Pick {
  course: Course;
  activity: Activity;
  sectionTitle: string;
  index: number;
  total: number;
}

/** Следующий шаг — первая незавершённая активность в курсе, который ближе всего к завершению. */
function pickNext(courses: Course[]): Pick | null {
  const inProgress = courses
    .filter((c) => (c.progress ?? 0) < 100)
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
  for (const course of inProgress) {
    for (const section of course.sections ?? []) {
      const idx = section.activities.findIndex((a) => !a.completed);
      if (idx >= 0) {
        return {
          course,
          activity: section.activities[idx],
          sectionTitle: section.title,
          index: idx + 1,
          total: section.activities.length,
        };
      }
    }
  }
  return null;
}

export function NextStep() {
  const user = useSession((s) => s.user);
  const { data: courses, isLoading } = useSWR<Course[]>("/api/courses?sections=1", fetcher);
  const next = courses ? pickNext(courses) : null;
  const tracked = next && TRACKED.includes(next.activity.type);
  const { data: progress } = useSWR<ActivityProgress | null>(
    tracked ? `/api/tracking/progress?userId=${user.id}&activityId=${next.activity.id}` : null,
    fetcher,
  );

  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-3 h-7 w-2/3" />
        <Skeleton className="mt-6 h-9 w-40" />
      </Card>
    );
  }

  if (!next) {
    return (
      <Card className="flex items-center gap-3 p-5">
        <CheckCircle2 size={20} className="text-success" aria-hidden />
        <div>
          <div className="font-semibold">Все материалы пройдены — так держать!</div>
          <div className="text-sm text-muted-foreground">
            Новые появятся, когда преподаватель откроет модуль.
          </div>
        </div>
      </Card>
    );
  }

  const { course, activity, sectionTitle, index, total } = next;
  const coverage = progress?.coverage ?? 0;
  const started = coverage > 0;

  return (
    <Card className="group grid overflow-hidden sm:grid-cols-[180px_1fr]">
      <CourseCover course={course} variant="thumb" className="h-24 sm:h-full" />
      <div className="flex min-w-0 flex-col gap-3 p-5">
        <div className="font-mono text-xs text-muted-foreground">
          <span className="rounded-full bg-highlight px-2 py-0.5 font-sans font-medium text-highlight-foreground">
            Следующий шаг
          </span>
          <span className="ml-2">
            {course.code} · {sectionTitle} · {index} из {total}
          </span>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{typeLabel[activity.type] ?? "Материал"}</div>
          <h2 className="text-xl leading-snug font-semibold text-balance">{activity.title}</h2>
        </div>
        {tracked && (
          <div className="flex items-center gap-3">
            <Progress value={coverage} className="max-w-xs flex-1" />
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {started ? `изучено ${Math.round(coverage)}%` : "не начато"}
            </span>
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
          <Link href={activityHref(course.id, activity)}>
            <Button>
              {started ? "Продолжить" : "Начать"} <ArrowRight size={16} />
            </Button>
          </Link>
          <Link
            href={`/courses/${course.id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {course.title}
          </Link>
        </div>
      </div>
    </Card>
  );
}
