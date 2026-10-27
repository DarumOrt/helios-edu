"use client";

import useSWR from "swr";
import { Lightbulb } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Badge, Card, CardBody, DataState } from "@/shared/ui";
import type { AdaptiveQuestion, Skill } from "@/shared/types/domain";

const answerLabel = (q: AdaptiveQuestion) =>
  q.type === "mcq"
    ? q.options[q.correct as number]
    : q.type === "boolean"
      ? q.correct
        ? "Верно"
        : "Неверно"
      : String(q.correct ?? "");

// Тест глазами преподавателя: вопросы с ответами, подсказками и навыками. Проходит тест только ученик.
export function QuizPreview({ courseId, activityId }: { courseId: string; activityId: string }) {
  const c = encodeURIComponent(courseId);
  const { data, error, isLoading } = useSWR<AdaptiveQuestion[]>(
    `/api/courses/${c}/quizzes/${encodeURIComponent(activityId)}/questions`,
    fetcher,
  );
  const { data: skills } = useSWR<Skill[]>(`/api/courses/${c}/skills`, fetcher);

  return (
    <DataState
      loading={isLoading}
      error={error}
      empty={!data?.length}
      emptyTitle="В тесте пока нет вопросов"
      emptyDescription="Добавьте их в конструкторе курса: «Редактировать содержание» → «Вопросы»."
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Так тест выглядит для преподавателя: с правильными ответами и подсказками. Ученики отвечают по одному
        вопросу и сразу видят, как меняется освоение навыков.
      </p>
      <ol className="space-y-3">
        {data?.map((q, i) => (
          <li key={q.id}>
            <Card>
              <CardBody className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">#{i + 1}</span>
                  {q.skillId && (
                    <Badge tone="primary">
                      {skills?.find((s) => s.id === q.skillId)?.title ?? q.skillId}
                    </Badge>
                  )}
                </div>
                <p className="font-medium">{q.text}</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Ответ: </span>
                  {answerLabel(q)}
                </p>
                {q.hints?.map((h, j) => (
                  <p key={j} className="flex gap-2 text-sm text-muted-foreground">
                    <Lightbulb size={14} className="mt-0.5 shrink-0" aria-hidden /> {h}
                  </p>
                ))}
              </CardBody>
            </Card>
          </li>
        ))}
      </ol>
    </DataState>
  );
}
