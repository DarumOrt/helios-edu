import Link from "next/link";
import { ArrowLeft, BookOpen, Check, ChevronRight } from "lucide-react";
import { activityHref, hasActivityPage } from "@/shared/lib/activity-href";
import { activityKindLabel } from "@/shared/lib/activity-meta";
import { pluralCount } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Badge, Disclosure } from "@/shared/ui";
import type { Course } from "@/shared/types/domain";

export function LessonRoute({ course, activityId }: { course: Course; activityId: string }) {
  const section = course.sections?.find((section) =>
    section.activities.some((item) => item.id === activityId),
  );
  if (!section) return null;

  return (
    <section aria-labelledby="lesson-route-title" className="min-w-0">
      <h2 id="lesson-route-title" className="mb-2 px-0.5 text-base font-semibold">
        Материалы модуля
      </h2>
      <Disclosure
        title={section.title}
        icon={<BookOpen size={17} />}
        meta={pluralCount(section.activities.length, "материал", "материала", "материалов")}
        defaultOpen
      >
        <ul className="divide-y">
          {section.activities.map((item) => {
            const current = item.id === activityId;
            const caption = current ? "Вы здесь" : activityKindLabel(item.type, item.title);
            const row = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug font-medium wrap-break-word">{item.title}</span>
                  {caption && <span className="mt-0.5 block text-xs text-muted-foreground">{caption}</span>}
                </span>
                {item.completed ? (
                  <Badge tone="success" aria-label="Завершено">
                    <Check size={13} aria-hidden />
                  </Badge>
                ) : !current && hasActivityPage(item.type) ? (
                  <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden />
                ) : null}
              </>
            );
            const className = cn(
              "flex items-center gap-2 rounded-md px-1.5 py-2.5",
              current && "bg-primary-soft/65",
            );
            return (
              <li key={item.id}>
                {current || !hasActivityPage(item.type) ? (
                  <div aria-current={current ? "page" : undefined} className={className}>
                    {row}
                  </div>
                ) : (
                  <Link
                    href={activityHref(course.id, item)}
                    className={cn(
                      className,
                      "hover:bg-muted/65 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset",
                    )}
                  >
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </Disclosure>
      <Link
        href={`/courses/${encodeURIComponent(course.id)}`}
        className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-primary underline-offset-3 hover:underline"
      >
        <ArrowLeft size={15} aria-hidden /> К содержанию курса
      </Link>
    </section>
  );
}
