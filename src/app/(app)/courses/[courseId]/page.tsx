"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Users,
  BookOpen,
  ListTree,
  BarChart3,
  Megaphone,
  Pencil,
  Check,
  Target,
  Route,
  Settings2,
  Trash2,
  CalendarClock,
} from "lucide-react";
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
  Disclosure,
} from "@/shared/ui";
import { CourseSection } from "@/features/courses/components/CourseSection";
import { StudentCourseHero } from "@/features/courses/components/StudentCourseHero";
import { EnrollmentPanel } from "@/features/courses/components/EnrollmentPanel";
import { CourseStatsPanel } from "@/features/analytics/components/CourseStatsPanel";
import { CoverEditor } from "@/features/courses/components/CoverEditor";
import { can } from "@/shared/auth/permissions";
import { canEditCourse } from "@/shared/auth/management";
import { CourseBuilder } from "@/features/course-builder/components/CourseBuilder";
import { CourseDialog } from "@/features/admin/components/CourseDialog";
import { DeleteCourseDialog } from "@/features/courses/components/DeleteCourseDialog";
import { CourseTrashPanel } from "@/features/course-builder/components/CourseTrashPanel";
import { AnnouncementDialog, AnnouncementsCard } from "@/features/course-builder/components/Announcements";
import { cn } from "@/shared/lib/utils";
import { AdaptiveRoute } from "@/features/adaptive/components/AdaptiveRoute";
import { SkillsEditor } from "@/features/adaptive/components/SkillsEditor";
import { AdaptivePanel } from "@/features/adaptive/components/AdaptivePanel";
import { useSession } from "@/shared/auth/session";
import { nextCourseMaterial, pendingDeadlines } from "@/shared/lib/learning-progress";
import { formatDate, pluralCount } from "@/shared/lib/format";
import { activityHref } from "@/shared/lib/activity-href";
import type { CatalogCourse, Course } from "@/shared/types/domain";

export default function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: course, error, isLoading } = useSWR<Course>(`/api/courses/${courseId}`, fetcher);
  const role = useSession((s) => s.role);
  const user = useSession((s) => s.user);
  const canSeeStats = can(role, "analytics.view");
  const learner = can(role, "quiz.take");
  const [aboutOpen, setAboutOpen] = useState(false);
  const { data: catalog } = useSWR<CatalogCourse[]>(learner && aboutOpen ? "/api/catalog" : null, fetcher);
  const tutor = catalog?.find((entry) => entry.id === courseId)?.tutor.name;
  const next = learner && course ? nextCourseMaterial(course) : null;
  const deadline = learner && course ? pendingDeadlines([course])[0] : undefined;
  // преподаватель правит только свой курс; администратор и организатор — любой
  const canViewRoster = can(user.role, "course.edit");
  const canEdit = course ? canEditCourse(user, course) : false;
  const [tab, setTab] = useState<"content" | "stats" | "skills" | "adaptive" | "trash" | "enrollment">(
    "content",
  );
  const [building, setBuilding] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [editingCard, setEditingCard] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div>
      <DataState loading={isLoading} error={error} empty={!course}>
        {course && (
          <>
            {learner ? (
              <>
                <StudentCourseHero course={course} next={next} />
                <div className={cn("mb-5 grid items-start gap-2.5", deadline && "md:grid-cols-2")}>
                  <Disclosure title="О курсе" icon={<BookOpen size={17} />} onOpenChange={setAboutOpen}>
                    <p className="py-2 text-sm leading-relaxed wrap-break-word whitespace-pre-line">
                      {course.description || "Описание пока не добавлено."}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pb-2 text-xs text-muted-foreground">
                      {tutor && <span>Преподаватель {tutor}</span>}
                      {course.faculty && <span>Факультет {course.faculty}</span>}
                      <span>{pluralCount(course.enrolled, "участник", "участника", "участников")}</span>
                    </div>
                  </Disclosure>
                  {deadline && (
                    <Link
                      href={activityHref(course.id, deadline.activity)}
                      className="flex min-h-14 items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 shadow-card hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset sm:px-4"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                        <CalendarClock size={17} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs text-muted-foreground">
                          Срок сдачи {formatDate(deadline.due)}
                        </span>
                        <span className="block text-sm leading-snug font-semibold wrap-break-word">
                          {deadline.activity.title}
                        </span>
                      </span>
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <>
                <PageHeader
                  title={course.title}
                  subtitle={`${course.code}, ${course.category}`}
                  actions={
                    canEdit && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingCard(true)}>
                          <Settings2 size={15} aria-hidden /> Карточка курса
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger"
                          onClick={() => setDeleting(true)}
                        >
                          <Trash2 size={15} aria-hidden /> Удалить курс
                        </Button>
                      </div>
                    )
                  }
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
                          <Users size={14} aria-hidden />{" "}
                          {pluralCount(course.enrolled, "участник", "участника", "участников")}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <BookOpen size={14} aria-hidden />{" "}
                          {pluralCount(course.sections?.length ?? 0, "модуль", "модуля", "модулей")}
                        </span>
                      </div>
                    </div>
                    {course.progress != null && (
                      <div className="md:border-l md:pl-5">
                        <div className="mb-1.5 text-sm text-muted-foreground">Средний прогресс группы</div>
                        <div className="font-mono text-3xl font-semibold tabular-nums">
                          {course.progress}%
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
              </>
            )}

            {/* Табы */}
            {(canSeeStats || canEdit) && (
              <div className="mb-5 flex flex-wrap gap-1 border-b">
                <Tab active={tab === "content"} onClick={() => setTab("content")} icon={ListTree}>
                  Содержание
                </Tab>
                {canSeeStats && (
                  <Tab active={tab === "stats"} onClick={() => setTab("stats")} icon={BarChart3}>
                    Статистика
                  </Tab>
                )}
                {canViewRoster && (
                  <Tab active={tab === "enrollment"} onClick={() => setTab("enrollment")} icon={Users}>
                    Участники
                  </Tab>
                )}
                {canEdit && (
                  <>
                    <Tab active={tab === "skills"} onClick={() => setTab("skills")} icon={Target}>
                      Навыки
                    </Tab>
                    <Tab active={tab === "adaptive"} onClick={() => setTab("adaptive")} icon={Route}>
                      Адаптация
                    </Tab>
                    <Tab active={tab === "trash"} onClick={() => setTab("trash")} icon={Trash2}>
                      Корзина
                    </Tab>
                  </>
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
            )}

            {tab === "content" && !building && !learner && <AnnouncementsCard courseId={course.id} />}
            {tab === "content" &&
              (building ? (
                <CourseBuilder course={course} />
              ) : (
                <>
                  <section className="min-w-0 space-y-2.5" aria-labelledby="course-content-title">
                    <h2 id="course-content-title" className="px-0.5 text-lg font-semibold tracking-tight">
                      Содержание курса
                    </h2>
                    {course.sections?.map((section, index) => (
                      <CourseSection
                        key={section.id}
                        section={section}
                        courseId={course.id}
                        nextId={next?.section.id === section.id ? next.activity.id : undefined}
                        defaultOpen={!learner || (next ? next.section.id === section.id : index === 0)}
                      />
                    ))}
                    {!course.sections?.length && (
                      <p className="py-4 text-sm text-muted-foreground">
                        {canEdit
                          ? "Чтобы добавить материалы, откройте «Редактировать содержание»."
                          : "В курсе пока нет материалов."}
                      </p>
                    )}
                  </section>
                  {learner && (
                    <div className="mt-5 space-y-2.5">
                      <AnnouncementsCard courseId={course.id} collapsed />
                      <AdaptiveRoute course={course} />
                    </div>
                  )}
                </>
              ))}
            {announcing && <AnnouncementDialog courseId={course.id} onClose={() => setAnnouncing(false)} />}
            {editingCard && (
              // название, описание, направление и статус; преподавателя, факультет и год — в «Администрирование → Курсы»
              <CourseDialog
                open
                onClose={() => setEditingCard(false)}
                course={course}
                tutors={[]}
                categories={[course.category]}
                managed={false}
              />
            )}

            {tab === "stats" && canSeeStats && <CourseStatsPanel courseId={course.id} />}
            {tab === "enrollment" && canViewRoster && (
              <EnrollmentPanel courseId={course.id} readOnly={!canEdit} />
            )}
            {tab === "skills" && canEdit && <SkillsEditor course={course} />}
            {tab === "adaptive" && canEdit && <AdaptivePanel course={course} />}
            {tab === "trash" && canEdit && <CourseTrashPanel course={course} />}
            {deleting && <DeleteCourseDialog course={course} onClose={() => setDeleting(false)} />}
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
      aria-pressed={active}
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
