"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { activityHref } from "@/shared/lib/activity-href";
import { activityKindLabel } from "@/shared/lib/activity-meta";
import { materialProgress, nextCourseMaterial } from "@/shared/lib/learning-progress";
import { buttonVariants, Skeleton } from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import type { Course } from "@/shared/types/domain";
import type { ActivityProgress } from "@/shared/lib/tracking/types";

export function NextStep({
  courses,
  loading,
  error,
}: {
  courses?: Course[];
  loading: boolean;
  error: unknown;
}) {
  const user = useSession((s) => s.user);
  const ordered = (courses ?? []).toSorted((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
  const course = ordered.find(nextCourseMaterial);
  const next = course && nextCourseMaterial(course);
  const tracked =
    next &&
    (next.activity.type === "video" || next.activity.type === "pdf" || next.activity.type === "presentation");
  const { data: progress } = useSWR<ActivityProgress | null>(
    course && tracked
      ? `/api/tracking/progress?courseId=${encodeURIComponent(course.id)}&activityId=${encodeURIComponent(next.activity.id)}&userId=${encodeURIComponent(user.id)}`
      : null,
    fetcher,
  );

  if (loading) return <Skeleton className="h-24 max-w-sm" />;
  if (error) return <p className="text-sm">Материалы не загрузились. Обновите страницу.</p>;
  if (!course || !next) {
    const { done, total } = materialProgress(courses ?? []);
    return (
      <div className="space-y-3">
        <p className="text-sm">
          {total > 0
            ? done === total
              ? "Вы завершили все материалы."
              : "Оставшиеся материалы можно найти в курсах."
            : courses?.length
              ? "В ваших курсах пока нет материалов."
              : "У вас пока нет курсов."}
        </p>
        <Link href="/courses" className={buttonVariants({ variant: "outline" })}>
          Мои курсы <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    );
  }

  const { activity } = next;
  const kind = activityKindLabel(activity.type, activity.title);
  const started = (progress?.coverage ?? 0) > 0 || (progress?.position ?? 0) > 0;
  return (
    <div>
      {kind && <p className="mb-1 text-xs font-medium">{kind}</p>}
      <h2 className="text-base leading-snug font-semibold text-balance sm:text-lg">{activity.title}</h2>
      <Link
        href={`/courses/${course.id}`}
        className="mt-1 block w-fit text-xs underline decoration-current/35 underline-offset-3 hover:decoration-current"
      >
        {course.title}
      </Link>
      <Link
        href={activityHref(course.id, activity)}
        className={buttonVariants({ size: "lg", className: "mt-3 max-w-full shadow-card" })}
      >
        {started ? "Продолжить обучение" : "Начать"} <ArrowRight size={16} aria-hidden />
      </Link>
    </div>
  );
}
