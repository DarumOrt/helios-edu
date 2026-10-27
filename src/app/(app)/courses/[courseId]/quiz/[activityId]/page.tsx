"use client";

import { use } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, Breadcrumbs } from "@/shared/ui";
import { AdaptiveQuiz } from "@/features/adaptive/components/AdaptiveQuiz";
import { QuizPreview } from "@/features/adaptive/components/QuizPreview";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import type { Course } from "@/shared/types/domain";

export default function QuizPage({ params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = use(params);
  const { data: course } = useSWR<Course>(`/api/courses/${courseId}`, fetcher);
  const title = course?.sections?.flatMap((s) => s.activities).find((a) => a.id === activityId)?.title;
  // проходит тест ученик; преподаватель видит вопросы с ответами
  const learner = can(
    useSession((s) => s.role),
    "quiz.take",
  );
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={title ?? "Тестирование"}
        subtitle={learner ? "Отвечайте по одному вопросу — проверка сразу" : "Просмотр теста"}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Курсы", href: "/courses" },
              { label: course?.title ?? "Курс", href: `/courses/${courseId}` },
              { label: "Тест" },
            ]}
          />
        }
      />
      {learner ? (
        <AdaptiveQuiz courseId={courseId} activityId={activityId} />
      ) : (
        <QuizPreview courseId={courseId} activityId={activityId} />
      )}
    </div>
  );
}
