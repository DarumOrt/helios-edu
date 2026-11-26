import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { Breadcrumbs, Card, Progress, WavePanel, buttonVariants } from "@/shared/ui";
import { activityHref } from "@/shared/lib/activity-href";
import { materialProgress, type nextCourseMaterial } from "@/shared/lib/learning-progress";
import { pluralCount } from "@/shared/lib/format";
import type { Course } from "@/shared/types/domain";

export function StudentCourseHero({
  course,
  next,
}: {
  course: Course;
  next: ReturnType<typeof nextCourseMaterial>;
}) {
  const { done, total, percent } = materialProgress([course]);
  return (
    <div className="mb-2.5 space-y-3">
      <Breadcrumbs items={[{ label: "Мои курсы", href: "/courses" }, { label: course.code }]} />
      <WavePanel className="grid min-h-44 items-center gap-3 p-4 sm:gap-4 sm:p-7 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={15} aria-hidden /> {course.code}
            </span>
            <span>{pluralCount(course.sections?.length ?? 0, "модуль", "модуля", "модулей")}</span>
          </div>
          <h1 className="mt-2 text-[clamp(1.25rem,6vw,1.5rem)] leading-tight font-bold tracking-tight text-balance wrap-break-word sm:text-4xl">
            {course.title}
          </h1>
          {next && (
            <Link
              href={activityHref(course.id, next.activity)}
              className={buttonVariants({ size: "lg", className: "mt-3 min-h-11 shadow-card" })}
            >
              Продолжить курс <ArrowRight size={16} aria-hidden />
            </Link>
          )}
        </div>
        {total > 0 && (
          <Card className="min-w-0 border-border/60 bg-card/85 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                Материалы курса
              </span>
              <span className="text-xs font-medium text-muted-foreground sm:hidden">
                Завершено {done} из {total}
              </span>
              <strong className="text-2xl leading-none font-semibold tabular-nums">{percent}%</strong>
            </div>
            <Progress
              value={percent}
              label="Доля завершённых материалов курса"
              className="mt-2.5"
              tone={done === total ? "success" : "primary"}
            />
            <p className="mt-2 hidden text-xs text-muted-foreground sm:block">
              Завершено {done} из {total}
            </p>
          </Card>
        )}
      </WavePanel>
    </div>
  );
}
