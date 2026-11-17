import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { Badge, Disclosure } from "@/shared/ui";
import { formatDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { activityHref, hasActivityPage } from "@/shared/lib/activity-href";
import { activityIcon, activityKindLabel } from "@/shared/lib/activity-meta";
import type { Section } from "@/shared/types/domain";

export function CourseSection({
  section,
  courseId,
  nextId,
  defaultOpen = true,
}: {
  section: Section;
  courseId: string;
  nextId?: string;
  defaultOpen?: boolean;
}) {
  const total = section.activities.length;
  const done = section.activities.filter((activity) => activity.completed).length;

  return (
    <Disclosure
      title={section.title}
      icon={
        <span
          className={cn(
            "grid size-8 place-items-center rounded-md font-mono text-xs font-semibold",
            nextId && "bg-primary text-primary-foreground",
          )}
        >
          {String(section.order).padStart(2, "0")}
        </span>
      }
      meta={total ? `${done} из ${total}` : "Пусто"}
      defaultOpen={defaultOpen}
    >
      {total > 0 ? (
        <ul className="divide-y">
          {section.activities.map((activity) => {
            const Icon = activityIcon[activity.type];
            const kind = activityKindLabel(activity.type, activity.title);
            const next = activity.id === nextId;
            const className = cn(
              "flex items-center gap-2.5 rounded-md px-1.5 py-2.5",
              next && "bg-primary-soft/55",
            );
            const row = (
              <>
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-md",
                    activity.completed ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon size={15} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug font-medium wrap-break-word">
                    {activity.title}
                  </span>
                  {(kind || activity.durationMin || activity.due) && (
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                      {kind && <span>{kind}</span>}
                      {activity.durationMin ? <span>{activity.durationMin} мин</span> : null}
                      {activity.due && <span>До {formatDate(activity.due)}</span>}
                    </span>
                  )}
                </span>
                {activity.completed ? (
                  <Badge tone="success">
                    <Check size={13} aria-hidden />
                    <span className="max-sm:sr-only">Завершено</span>
                  </Badge>
                ) : next ? (
                  <Badge tone="primary">Далее</Badge>
                ) : hasActivityPage(activity.type) ? (
                  <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden />
                ) : null}
              </>
            );
            return (
              <li key={activity.id} id={`a-${activity.id}`} className="scroll-mt-24">
                {hasActivityPage(activity.type) ? (
                  <Link
                    href={activityHref(courseId, activity)}
                    className={cn(
                      className,
                      "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset",
                    )}
                  >
                    {row}
                  </Link>
                ) : (
                  <div className={className}>{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-2 text-sm text-muted-foreground">В этом модуле пока нет материалов.</p>
      )}
    </Disclosure>
  );
}
