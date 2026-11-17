"use client";

import { use } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { DataState } from "@/shared/ui";
import { LessonHeader } from "@/features/player/LessonHeader";
import { LessonRoute } from "@/features/player/LessonRoute";
import { AdaptiveQuiz } from "@/features/adaptive/components/AdaptiveQuiz";
import { QuizPreview } from "@/features/adaptive/components/QuizPreview";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import type { Course } from "@/shared/types/domain";

export default function QuizPage({ params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = use(params);
  const { data: course, isLoading, error } = useSWR<Course>(`/api/courses/${courseId}`, fetcher);
  const activity = course?.sections
    ?.flatMap((section) => section.activities)
    .find((item) => item.id === activityId);
  // проходит тест ученик; преподаватель видит вопросы с ответами
  const learner = can(
    useSession((s) => s.role),
    "quiz.take",
  );
  return (
    <DataState
      loading={isLoading}
      error={error}
      empty={activity?.type !== "quiz"}
      emptyTitle="Тест не найден"
    >
      {course && activity && (
        <>
          <LessonHeader
            courseCode={course.code}
            courseId={courseId}
            title={activity.title}
            type="quiz"
            durationMin={activity.durationMin}
          />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0" key={`${courseId}/${activityId}`}>
              {learner ? (
                <AdaptiveQuiz courseId={courseId} activityId={activityId} />
              ) : (
                <QuizPreview courseId={courseId} activityId={activityId} />
              )}
            </div>
            <LessonRoute course={course} activityId={activityId} />
          </div>
        </>
      )}
    </DataState>
  );
}
