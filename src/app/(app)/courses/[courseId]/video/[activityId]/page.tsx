"use client";

import { use } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { DataState } from "@/shared/ui";
import { VideoPlayer } from "@/features/player/VideoPlayer";
import { LessonHeader } from "@/features/player/LessonHeader";
import { LessonRoute } from "@/features/player/LessonRoute";
import { LessonStatsPanel } from "@/features/analytics/components/LessonStatsPanel";
import { RoleGate } from "@/shared/auth/RoleGate";
import { useActivityEvents } from "@/features/adaptive/useActivityEvents";
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
    .find((a) => a.id === activityId && a.type === "video");
  const onComplete = useActivityEvents(courseId, activity?.id);

  return (
    <div>
      <DataState loading={isLoading} error={error} empty={!activity}>
        {course && activity && (
          <>
            <LessonHeader
              courseId={courseId}
              courseCode={course.code}
              title={activity.title}
              type="video"
              durationMin={activity.durationMin}
            />
            <VideoPlayer
              key={`${courseId}/${activity.id}`}
              courseId={courseId}
              activityId={activity.id}
              src={activity.src ?? "/media/lesson-matan.mp4"}
              title={activity.title}
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
