"use client";

import { use, useState } from "react";
import useSWR from "swr";
import { Users, BookOpen, ListTree, BarChart3, Megaphone, Pencil, Check } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import {
  PageHeader,
  DataState,
  Card,
  CardBody,
  CourseCover,
  Progress,
  Breadcrumbs,
  Button,
} from "@/shared/ui";
import { CourseSection } from "@/features/courses/components/CourseSection";
import { CourseStatsPanel } from "@/features/analytics/components/CourseStatsPanel";
import { CoverEditor } from "@/features/courses/components/CoverEditor";
import { can } from "@/shared/auth/permissions";
import { canEditCourse } from "@/shared/auth/management";
import { CourseBuilder } from "@/features/course-builder/components/CourseBuilder";
import { AnnouncementDialog, AnnouncementsCard } from "@/features/course-builder/components/Announcements";
import { cn } from "@/shared/lib/utils";
import { useSession } from "@/shared/auth/session";
import type { Course } from "@/shared/types/domain";

export default function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: course, error, isLoading } = useSWR<Course>(`/api/courses/${courseId}`, fetcher);
  const role = useSession((s) => s.role);
  const user = useSession((s) => s.user);
  const canSeeStats = can(role, "analytics.view");
  // преподаватель правит только свой курс; администратор и организатор — любой
  const canEdit = course ? canEditCourse(user, course) : false;
  const [tab, setTab] = useState<"content" | "stats">("content");
  const [building, setBuilding] = useState(false);
  const [announcing, setAnnouncing] = useState(false);

  return (
    <div>
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
              <div className="relative">
                <CourseCover course={course} variant="banner" className="h-36 md:h-44" />
                {canEdit && (
                  <div className="absolute top-4 right-4">
                    <CoverEditor course={course} />
                  </div>
                )}
              </div>
              <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <p className="text-foreground/80">{course.description}</p>
                  <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users size={14} /> {course.enrolled} участников
                    </span>
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={14} /> {course.sections?.length ?? 0} модулей
                    </span>
                  </div>
                </div>
                {course.progress != null && (
                  <div className="md:border-l md:pl-5">
                    <div className="mb-1.5 text-sm text-muted-foreground">
                      {canSeeStats ? "Средний прогресс группы" : "Ваш прогресс"}
                    </div>
                    <div className="font-mono text-3xl font-semibold tabular-nums">{course.progress}%</div>
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
              {canEdit && tab === "content" && (
                <div className="ml-auto flex items-center gap-2 pb-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setAnnouncing(true)}>
                    <Megaphone size={15} aria-hidden /> Объявление
                  </Button>
                  <Button
                    variant={building ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setBuilding((b) => !b)}
                    aria-pressed={building}
                  >
                    {building ? <Check size={15} aria-hidden /> : <Pencil size={15} aria-hidden />}
                    {building ? "Готово" : "Редактировать содержание"}
                  </Button>
                </div>
              )}
            </div>

            {tab === "content" && !building && <AnnouncementsCard courseId={course.id} />}
            {tab === "content" &&
              (building ? (
                <CourseBuilder course={course} />
              ) : (
                <div className="space-y-3">
                  {course.sections?.map((s) => (
                    <CourseSection key={s.id} section={s} courseId={course.id} />
                  ))}
                  {!course.sections?.length && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Материалы скоро появятся{canEdit ? " — нажмите «Редактировать содержание»" : ""}
                    </p>
                  )}
                </div>
              ))}
            {announcing && <AnnouncementDialog courseId={course.id} onClose={() => setAnnouncing(false)} />}

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
