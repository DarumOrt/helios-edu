"use client";

import { use, useState } from "react";
import useSWR from "swr";
import { Users, BookOpen, ListTree, BarChart3 } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Card, CardBody, Progress, Breadcrumbs } from "@/shared/ui";
import { CourseSection } from "@/features/courses/components/CourseSection";
import { CourseStatsPanel } from "@/features/analytics/components/CourseStatsPanel";
import { gradientFor, cn } from "@/shared/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import type { Course } from "@/shared/types/domain";

export default function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: course, error, isLoading } = useSWR<Course>(`/api/courses/${courseId}`, fetcher);
  const role = useSessionStore((s) => s.role);
  const canSeeStats = role === "tutor" || role === "admin" || role === "organizer";
  const [tab, setTab] = useState<"content" | "stats">("content");

  return (
    <div className="animate-fade-in">
      <DataState loading={isLoading} error={error} empty={!course}>
        {course && (
          <>
            <PageHeader
              title={course.title}
              subtitle={`${course.code} · ${course.category}`}
              breadcrumbs={
                <Breadcrumbs items={[{ label: "Курсы", href: "/courses" }, { label: course.title }]} />
              }
            />

            <Card className="mb-6 overflow-hidden">
              <div className={`h-2 bg-linear-to-r ${gradientFor(course.id)}`} />
              <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <p className="text-sm text-foreground/80">{course.description}</p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users size={13} /> {course.enrolled} участников
                    </span>
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={13} /> {course.sections?.length ?? 0} секций
                    </span>
                  </div>
                </div>
                {course.progress != null && (
                  <div className="md:border-l md:pl-5">
                    <div className="mb-1.5 text-xs text-muted-foreground">
                      {canSeeStats ? "Средний прогресс группы" : "Ваш прогресс"}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold">{course.progress}%</span>
                    </div>
                    <Progress
                      value={course.progress}
                      tone={course.progress >= 80 ? "success" : "primary"}
                      className="mt-2"
                    />
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Табы */}
            <div className="mb-5 flex gap-1 border-b">
              <Tab active={tab === "content"} onClick={() => setTab("content")} icon={ListTree}>
                Содержание
              </Tab>
              {canSeeStats && (
                <Tab active={tab === "stats"} onClick={() => setTab("stats")} icon={BarChart3}>
                  Статистика
                </Tab>
              )}
            </div>

            {tab === "content" && (
              <div className="space-y-3">
                {course.sections?.map((s) => (
                  <CourseSection key={s.id} section={s} courseId={course.id} />
                ))}
              </div>
            )}

            {tab === "stats" && canSeeStats && <CourseStatsPanel courseId={course.id} />}
          </>
        )}
      </DataState>
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BarChart3;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition",
        active
          ? "border-primary font-medium text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon size={15} />
      {children}
    </button>
  );
}
