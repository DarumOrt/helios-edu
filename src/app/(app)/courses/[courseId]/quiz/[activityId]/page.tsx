"use client";

import { use } from "react";
import { PageHeader, Breadcrumbs } from "@/shared/ui";
import { QuizPlayer } from "@/features/quiz/components/QuizPlayer";

export default function QuizPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
}) {
  const { courseId, activityId } = use(params);
  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <PageHeader
        title="Тестирование"
        subtitle="Ответьте на все вопросы и завершите тест"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Курсы", href: "/courses" },
              { label: "Курс", href: `/courses/${courseId}` },
              { label: "Тест" },
            ]}
          />
        }
      />
      <QuizPlayer quizId={activityId} />
    </div>
  );
}
