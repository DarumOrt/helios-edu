"use client";

import { use } from "react";
import useSWR from "swr";
import { CalendarClock, Award } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Card, CardBody, DataState } from "@/shared/ui";
import { LessonHeader } from "@/features/player/LessonHeader";
import { LessonRoute } from "@/features/player/LessonRoute";
import { formatDateTime } from "@/shared/lib/format";
import { SubmissionForm } from "@/features/assignment/components/SubmissionForm";
import type { Course } from "@/shared/types/domain";

export default function AssignmentPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
}) {
  const { courseId, activityId } = use(params);
  const { data: course, error, isLoading } = useSWR<Course>(`/api/courses/${courseId}`, fetcher);
  const activity = course?.sections?.flatMap((s) => s.activities).find((a) => a.id === activityId);

  return (
    <div>
      <DataState
        loading={isLoading}
        error={error}
        empty={activity?.type !== "assignment"}
        emptyTitle="Задание не найдено"
      >
        {course && activity && (
          <>
            <LessonHeader
              courseId={courseId}
              courseCode={course.code}
              title={activity.title}
              type="assignment"
            />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <Card className="mb-5">
                  <CardBody className="space-y-3">
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      {activity.due && (
                        <span className="flex items-center gap-1.5">
                          <CalendarClock size={15} aria-hidden /> Сдать до{" "}
                          <span className="font-mono text-foreground">{formatDateTime(activity.due)}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Award size={15} aria-hidden /> Максимальный балл{" "}
                        <span className="font-mono text-foreground">{activity.maxGrade ?? 100}</span>
                      </span>
                    </div>
                    <p className="font-serif text-base leading-relaxed whitespace-pre-line text-foreground/90">
                      {activity.description || "Условие задания преподаватель объяснит на занятии."}
                    </p>
                  </CardBody>
                </Card>
                <SubmissionForm
                  key={`${courseId}/${activityId}`}
                  courseId={courseId}
                  assignmentId={activityId}
                />
              </div>
              <LessonRoute course={course} activityId={activity.id} />
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
