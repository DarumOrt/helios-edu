import type { ReactNode } from "react";
import Link from "next/link";
import { activityIcon, activityKindLabel, activityLabel } from "@/shared/lib/activity-meta";
import { Breadcrumbs, WavePanel } from "@/shared/ui";
import type { ActivityType } from "@/shared/types/domain";

export function LessonHeader({
  courseId,
  courseCode,
  title,
  type,
  durationMin,
  actions,
  standalone,
}: {
  courseId: string;
  courseCode?: string;
  title: string;
  type: ActivityType;
  durationMin?: number;
  actions?: ReactNode;
  standalone?: boolean;
}) {
  const Icon = activityIcon[type];
  const kind = activityKindLabel(type, title);
  if (standalone)
    return (
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="min-w-0 text-base font-semibold wrap-break-word sm:text-lg">{title}</h1>
        <Link
          href={`/courses/${encodeURIComponent(courseId)}`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
        >
          К курсу
        </Link>
      </header>
    );
  return (
    <div className="mb-5 space-y-3">
      <Breadcrumbs
        items={[
          { label: "Курсы", href: "/courses" },
          { label: courseCode || "Курс", href: `/courses/${encodeURIComponent(courseId)}` },
          { label: activityLabel[type] },
        ]}
      />
      <WavePanel animated={false} className="px-4 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {(kind || durationMin) && (
              <p className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Icon size={15} aria-hidden />
                  {kind}
                </span>
                {durationMin ? <span>{durationMin} мин</span> : null}
              </p>
            )}
            <h1 className="text-2xl leading-tight font-bold tracking-tight text-balance wrap-break-word sm:text-3xl">
              {title}
            </h1>
          </div>
          {actions}
        </div>
      </WavePanel>
    </div>
  );
}
