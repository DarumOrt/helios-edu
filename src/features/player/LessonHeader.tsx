import type { ReactNode } from "react";
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
}: {
  courseId: string;
  courseCode?: string;
  title: string;
  type: ActivityType;
  durationMin?: number;
  actions?: ReactNode;
}) {
  const Icon = activityIcon[type];
  const kind = activityKindLabel(type, title);
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
