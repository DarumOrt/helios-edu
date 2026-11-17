"use client";

import { use } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { ExternalLink } from "lucide-react";
import { DataState, buttonVariants } from "@/shared/ui";
import { DocumentReader } from "@/features/player/DocumentReader";
import { LessonHeader } from "@/features/player/LessonHeader";
import { LessonRoute } from "@/features/player/LessonRoute";
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
    .find((a) => a.id === activityId && (a.type === "pdf" || a.type === "presentation"));
  const onComplete = useActivityEvents(courseId, activity?.id);

  const kind = activity?.type === "presentation" ? "presentation" : "pdf";

  return (
    <div>
      <DataState loading={isLoading} error={error} empty={!activity}>
        {course && activity && (
          <>
            <LessonHeader
              courseId={courseId}
              courseCode={course.code}
              title={activity.title}
              type={kind}
              durationMin={activity.durationMin}
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
            />
            <DocumentReader
              key={`${courseId}/${activity.id}`}
              courseId={courseId}
              activityId={activity.id}
              kind={kind}
              hasFile={Boolean(activity.src)}
              totalPages={activity.pages ?? 10}
              onComplete={onComplete}
              navigation={<LessonRoute course={course} activityId={activity.id} />}
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
