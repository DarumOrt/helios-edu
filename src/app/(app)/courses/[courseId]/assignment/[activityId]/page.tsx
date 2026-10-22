"use client";

import { use } from "react";
import useSWR from "swr";
import { CalendarClock, Award } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, Breadcrumbs, Card, CardBody, DataState } from "@/shared/ui";
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
    <div className="mx-auto max-w-3xl">
      <DataState loading={isLoading} error={error} empty={!activity} emptyTitle="Задание не найдено">
        {course && activity && (
          <>
            <PageHeader
              title={activity.title}
              subtitle={`${course.code} · ${course.title}`}
              breadcrumbs={
                <Breadcrumbs
                  items={[
                    { label: "Курсы", href: "/courses" },
                    { label: course.title, href: `/courses/${courseId}` },
                    { label: "Задание" },
                  ]}
                />
              }
            />
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
                    <Award size={15} aria-hidden /> Оценка из{" "}
                    <span className="font-mono text-foreground">{activity.maxGrade ?? 100}</span>
                  </span>
                </div>
                <p className="font-serif text-base leading-relaxed whitespace-pre-line text-foreground/90">
                  {activity.description || "Условие задания преподаватель объяснит на занятии."}
                </p>
              </CardBody>
            </Card>
            <SubmissionForm courseId={courseId} assignmentId={activityId} />
          </>
        )}
      </DataState>
    </div>
  );
}
