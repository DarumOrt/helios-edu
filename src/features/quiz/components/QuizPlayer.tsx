"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, Trophy } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Button, Card, CardBody, DataState, Progress, Badge } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { quizApi } from "../api";
import type { QuizQuestion } from "@/shared/types/domain";

export function QuizPlayer({ quizId }: { quizId: string }) {
  const { data, error, isLoading } = useSWR<QuizQuestion[]>(
    `/api/quiz/${quizId}/questions`,
    fetcher
  );
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<{ score: number; max: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = data?.length ?? 0;
  const answered = Object.keys(answers).length;
  const progress = total ? (answered / total) * 100 : 0;

  async function onSubmit() {
    setSubmitting(true);
    try {
      const r = await quizApi.submit(quizId, answers);
      setResult({ score: r.score, max: r.max });
      toast.success("Тест отправлен", { description: `Результат: ${r.score} из ${r.max}` });
    } catch {
      toast.error("Не удалось отправить тест");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DataState loading={isLoading} error={error} empty={!data?.length}>
      {result ? (
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-success to-emerald-400" />
          <CardBody className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-success-soft text-success mx-auto flex items-center justify-center">
              <Trophy size={28} />
            </div>
            <div className="mt-4 text-sm text-muted-foreground">Тест завершён</div>
            <div className="text-5xl font-bold mt-2 tabular-nums">
              {result.score}
              <span className="text-2xl text-muted-foreground"> / {result.max}</span>
            </div>
            <Badge tone={result.score / result.max >= 0.8 ? "success" : "warning"} className="mt-3">
              {Math.round((result.score / result.max) * 100)}%
            </Badge>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardBody className="py-3">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium">Прогресс</span>
                <span className="text-muted-foreground tabular-nums">
                  {answered} из {total}
                </span>
              </div>
              <Progress value={progress} />
            </CardBody>
          </Card>

          {data?.map((q, idx) => (
            <Card key={q.id}>
              <CardBody>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 rounded-md bg-primary-soft text-primary text-xs font-semibold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-muted-foreground">Вопрос {idx + 1} из {total}</span>
                </div>
                <div className="font-medium text-base mb-4">{q.text}</div>

                {q.type === "mcq" && (
                  <div className="grid gap-2">
                    {q.options?.map((opt, i) => {
                      const selected = answers[q.id] === i;
                      return (
                        <label
                          key={i}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-md border cursor-pointer transition",
                            selected
                              ? "border-primary bg-primary-soft"
                              : "border-border hover:bg-muted/40"
                          )}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            className="sr-only"
                            checked={selected}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                          />
                          <span
                            className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                              selected ? "border-primary" : "border-muted-foreground/40"
                            )}
                          >
                            {selected && <span className="w-2 h-2 rounded-full bg-primary" />}
                          </span>
                          <span className="text-sm">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {q.type === "boolean" && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: true, l: "Верно" },
                      { v: false, l: "Неверно" },
                    ].map((o) => {
                      const selected = answers[q.id] === o.v;
                      return (
                        <button
                          key={String(o.v)}
                          type="button"
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.v }))}
                          className={cn(
                            "px-4 py-3 rounded-md border text-sm font-medium transition",
                            selected
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-border hover:bg-muted/40"
                          )}
                        >
                          {selected && <CheckCircle2 size={14} className="inline mr-2" />}
                          {o.l}
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.type === "short" && (
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring"
                    value={(answers[q.id] as string) ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder="Ваш ответ"
                  />
                )}
              </CardBody>
            </Card>
          ))}

          <div className="sticky bottom-4 flex justify-end">
            <Button onClick={onSubmit} disabled={submitting} size="lg" className="shadow-elevate">
              {submitting ? "Отправка…" : "Завершить тест"}
            </Button>
          </div>
        </div>
      )}
    </DataState>
  );
}
