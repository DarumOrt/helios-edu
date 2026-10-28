"use client";

import { use } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { ExternalLink } from "lucide-react";
import { PageHeader, Breadcrumbs, DataState, buttonVariants } from "@/shared/ui";
import { DocumentReader } from "@/features/player/DocumentReader";
import { LessonStatsPanel } from "@/features/analytics/components/LessonStatsPanel";
import { RoleGate } from "@/shared/auth/RoleGate";
import { useActivityEvents } from "@/features/adaptive/useActivityEvents";
import type { Course, Activity } from "@/shared/types/domain";

export default function DocumentLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
}) {
  const { courseId, activityId } = use(params);
  const { data: course, isLoading, error } = useSWR<Course>(`/api/courses/${courseId}`, fetcher);

  const activity: Activity | undefined = course?.sections
    ?.flatMap((s) => s.activities)
    .find((a) => a.id === activityId);
  const onComplete = useActivityEvents(courseId, activity?.id);

  const kind = activity?.type === "presentation" ? "presentation" : "pdf";

  return (
    <div>
      <DataState loading={isLoading} error={error} empty={!activity}>
        {activity && (
          <>
            <PageHeader
              title={activity.title}
              subtitle={`${kind === "pdf" ? "PDF-документ" : "Презентация"} · просмотр отслеживается`}
              actions={
                // сам файл (загруженный — /api/files/…); встроенный просмотр PDF — следующий шаг (PDF.js)
                activity.src && (
                  <a
                    href={activity.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <ExternalLink size={15} aria-hidden /> Открыть файл
                  </a>
                )
              }
              breadcrumbs={
                <Breadcrumbs
                  items={[
                    { label: "Курсы", href: "/courses" },
                    { label: course?.title ?? "Курс", href: `/courses/${courseId}` },
                    { label: kind === "pdf" ? "Конспект" : "Презентация" },
                  ]}
                />
              }
            />
            <DocumentReader
              courseId={courseId}
              activityId={activity.id}
              kind={kind}
              title={activity.title}
              totalPages={activity.pages ?? 10}
              onComplete={onComplete}
            />
            <RoleGate roles={["tutor", "admin", "organizer"]}>
              <div className="mt-8">
                <LessonStatsPanel courseId={courseId} activityId={activity.id} title="Статистика по уроку" />
              </div>
            </RoleGate>
          </>
        )}
      </DataState>
    </div>
  );
}
