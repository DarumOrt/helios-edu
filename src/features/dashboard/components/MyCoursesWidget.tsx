import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { CourseCover, DataState, Disclosure, Progress } from "@/shared/ui";
import { materialProgress } from "@/shared/lib/learning-progress";
import { pluralCount } from "@/shared/lib/format";
import type { Course } from "@/shared/types/domain";

export function MyCoursesWidget({
  courses,
  loading,
  error,
}: {
  courses?: Course[];
  loading: boolean;
  error: unknown;
}) {
  return (
    <Disclosure
      title="Мои курсы"
      icon={<BookOpen size={17} />}
      defaultOpen
      meta={courses && pluralCount(courses.length, "курс", "курса", "курсов")}
    >
      <DataState loading={loading} error={error} empty={!courses?.length} emptyTitle="Курсов пока нет">
        <ul className="divide-y">
          {courses?.slice(0, 4).map((course) => {
            const { done, total, percent } = materialProgress([course]);
            return (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.id}`}
                  className="flex items-center gap-3 rounded-md px-1 py-2.5 hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset"
                >
                  <CourseCover
                    course={course}
                    variant="thumb"
                    className="hidden h-10 w-12 shrink-0 rounded-lg sm:block"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug font-medium wrap-break-word">{course.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {total ? `Завершено ${done} из ${total}` : "Материалов пока нет"}
                    </p>
                  </div>
                  {total > 0 && (
                    <div className="w-10 shrink-0 text-right sm:w-14">
                      <Progress value={percent} label={`Материалы курса «${course.title}»`} />
                      <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>
                    </div>
                  )}
                  <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/courses"
          className="inline-block py-2 text-sm font-medium text-primary underline-offset-3 hover:underline"
        >
          Все курсы
        </Link>
      </DataState>
    </Disclosure>
  );
}
