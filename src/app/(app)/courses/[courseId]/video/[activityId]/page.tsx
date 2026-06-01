"use client";

import { use } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, Breadcrumbs, DataState } from "@/shared/ui";
import { VideoPlayer } from "@/features/player/VideoPlayer";
import { LessonStatsPanel } from "@/features/analytics/components/LessonStatsPanel";
import { RoleGate } from "@/shared/auth/RoleGate";
import type { Course, Activity } from "@/shared/types/domain";

export default function VideoLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
}) {
  const { courseId, activityId } = use(params);
  const { data: course, isLoading, error } = useSWR<Course>(`/api/courses/${courseId}`, fetcher);

  const activity: Activity | undefined = course?.sections
    ?.flatMap((s) => s.activities)
    .find((a) => a.id === activityId);

  return (
    <div className="animate-fade-in">
      <DataState loading={isLoading} error={error} empty={!activity}>
        {activity && (
          <>
            <PageHeader
              title={activity.title}
              subtitle="Видеолекция · просмотр отслеживается"
              breadcrumbs={
                <Breadcrumbs
                  items={[
                    { label: "Курсы", href: "/courses" },
                    { label: course?.title ?? "Курс", href: `/courses/${courseId}` },
                    { label: "Видеолекция" },
                  ]}
                />
              }
            />
            <VideoPlayer
              activityId={activity.id}
              src={activity.src ?? "/media/lesson-matan.mp4"}
              title={activity.title}
            />
            <RoleGate roles={["tutor", "admin", "organizer"]}>
              <div className="mt-8">
                <LessonStatsPanel activityId={activity.id} title="Статистика по уроку" />
              </div>
            </RoleGate>
          </>
        )}
      </DataState>
    </div>
  );
}
