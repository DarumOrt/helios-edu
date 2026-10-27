"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { facultyName } from "@/shared/lib/faculties";
import { Badge, Breadcrumbs, Card, CardBody, CourseCover, DataState, buttonVariants } from "@/shared/ui";
import type { CatalogCourse } from "@/shared/types/domain";
import { directionOf, studyYearOf } from "../filters";

// Карточка курса из поиска: описание, преподаватель, группы и модули — без материалов.
export function CatalogPreview({ courseId }: { courseId: string }) {
  const { data, error, isLoading } = useSWR<CatalogCourse[]>("/api/catalog", fetcher);
  const course = data?.find((c) => c.id === courseId);

  return (
    <DataState
      loading={isLoading}
      error={error}
      empty={!isLoading && !course}
      emptyTitle="Курс не найден"
      emptyDescription="Возможно, его сняли с публикации."
    >
      {course && (
        <div className="mx-auto max-w-3xl space-y-6">
          <Breadcrumbs items={[{ label: "Поиск", href: "/search" }, { label: course.code }]} />
          <Card className="overflow-hidden">
            <CourseCover course={course} variant="banner" className="h-32" />
            <CardBody className="space-y-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">
                  {[course.code, course.faculty && facultyName(course.faculty), course.academicYear]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight">{course.title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{course.description}</p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Преподаватель</dt>
                  <dd className="mt-0.5 font-medium">{course.tutor.name || "не назначен"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Дисциплина</dt>
                  <dd className="mt-0.5 font-medium">{course.category}</dd>
                </div>
              </dl>
              {course.cohorts.length > 0 && (
                <div>
                  <h2 className="text-xs text-muted-foreground">Группы</h2>
                  <ul className="mt-1.5 space-y-1.5">
                    {course.cohorts.map((g) => (
                      <li key={g.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge tone="primary">{g.name}</Badge>
                        <span className="text-muted-foreground">
                          {[studyYearOf(g)?.label, directionOf(g)?.label, g.profile]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          <section aria-labelledby="modules">
            <h2 id="modules" className="mb-2 text-sm font-medium text-muted-foreground">
              Содержание курса
            </h2>
            <ol className="space-y-2">
              {course.sections.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-sm shadow-card"
                >
                  <span>{s.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">материалов: {s.activities}</span>
                </li>
              ))}
            </ol>
          </section>

          {course.accessible ? (
            <Link href={`/courses/${course.id}`} className={buttonVariants()}>
              Перейти к курсу <ArrowRight size={16} aria-hidden />
            </Link>
          ) : (
            <p className="flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
              {course.cohorts.length
                ? `Материалы открыты слушателям групп ${course.cohorts.map((g) => g.name).join(", ")}. Если вы должны учиться на этом курсе — обратитесь к организатору.`
                : "Курс пока не назначен ни одной группе."}
            </p>
          )}
          <Link href="/search" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft size={16} aria-hidden /> К поиску
          </Link>
        </div>
      )}
    </DataState>
  );
}
