"use client";

import dynamic from "next/dynamic";
import { use } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { useMaterialView } from "@/shared/lib/material-view";
import { ExternalLink } from "lucide-react";
import { DataState, buttonVariants } from "@/shared/ui";
import { DocumentReader } from "@/features/player/DocumentReader";
import { LessonHeader } from "@/features/player/LessonHeader";
import { LessonRoute } from "@/features/player/LessonRoute";
import { LessonStatsPanel } from "@/features/analytics/components/LessonStatsPanel";
import { RoleGate } from "@/shared/auth/RoleGate";
import { useActivityEvents } from "@/features/adaptive/useActivityEvents";
import type { Course, Activity } from "@/shared/types/domain";

const PdfReader = dynamic(() => import("@/features/player/PdfReader"), {
  ssr: false,
  loading: () => <p>Загрузка PDF…</p>,
});

export default function DocumentLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
}) {
  const { courseId, activityId } = use(params);
  const standalone = useMaterialView();
  const { data: course, isLoading, error } = useSWR<Course>(`/api/courses/${courseId}`, fetcher);

  const activity: Activity | undefined = course?.sections
    ?.flatMap((s) => s.activities)
    .find((a) => a.id === activityId && (a.type === "pdf" || a.type === "presentation"));
  const kind = activity?.type === "presentation" ? "presentation" : "pdf";
  const src = activity?.src;
  const showPdf =
    kind === "pdf" || Boolean(src?.startsWith("/api/files/") || /\.pdf(?:[?#]|$)/i.test(src ?? ""));
  const { onViewed, onComplete } = useActivityEvents(courseId, activity?.id, !showPdf);
  const navigation =
    course && !standalone ? <LessonRoute course={course} activityId={activityId} /> : undefined;

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
              standalone={standalone}
              actions={
                !showPdf &&
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
            {showPdf ? (
              <PdfReader
                key={`${courseId}/${activity.id}/${activity.src}`}
                courseId={courseId}
                activityId={activity.id}
                src={activity.src}
                kind={kind}
                standalone={standalone}
                navigation={navigation}
                onViewed={onViewed}
                onComplete={onComplete}
              />
            ) : (
              <DocumentReader
                key={`${courseId}/${activity.id}`}
                courseId={courseId}
                activityId={activity.id}
                kind="presentation"
                hasFile={Boolean(activity.src)}
                totalPages={activity.pages ?? 10}
                onComplete={onComplete}
                navigation={navigation}
              />
            )}
            {!standalone && (
              <RoleGate roles={["tutor", "admin", "organizer"]}>
                <div className="mt-8">
                  <LessonStatsPanel
                    courseId={courseId}
                    activityId={activity.id}
                    title="Статистика по уроку"
                  />
                </div>
              </RoleGate>
            )}
          </>
        )}
      </DataState>
    </div>
  );
}
