"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Button, DataState, Dialog, Input, Select, Textarea } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { validateQuestions } from "@/shared/lib/content-validation";
import type { Activity, QuizQuestion } from "@/shared/types/domain";
import { builderApi, refreshCourse } from "../api";

const typeLabel: Record<QuizQuestion["type"], string> = {
  mcq: "Один вариант из нескольких",
  boolean: "Верно или неверно",
  short: "Короткий ответ",
};

const blank = (type: QuizQuestion["type"] = "mcq"): QuizQuestion => ({
  id: "",
  type,
  text: "",
  ...(type === "mcq" && { options: ["", ""], correct: 0 }),
  ...(type === "boolean" && { correct: true }),
  ...(type === "short" && { correct: "" }),
});

// Вопросы теста целиком: редактируем копию и сохраняем одним запросом.
export function QuestionsDialog({
  open,
  onClose,
  courseId,
  quiz,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  quiz: Activity;
}) {
  const {
    data,
    error: loadError,
    isLoading,
  } = useSWR<QuizQuestion[]>(`/api/courses/${courseId}/quizzes/${quiz.id}/questions`, fetcher, {
    revalidateOnFocus: false,
  });
  // null — пока не начали править, показываем загруженные вопросы
  const [draft, setDraft] = useState<QuizQuestion[] | null>(null);
  const questions = draft ?? data ?? [];
  const { pending, error, run } = useFormSubmit();
  const [clientError, setClientError] = useState("");

  const update = (i: number, patch: Partial<QuizQuestion>) =>
    setDraft(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const remove = (i: number) => setDraft(questions.filter((_, j) => j !== i));

  async function save() {
    const problem = validateQuestions(questions).questions;
    setClientError(problem ?? "");
    if (problem) return;
    const saved = await run(() => builderApi.saveQuestions(courseId, quiz.id, questions));
    if (!saved) return;
    await refreshCourse(courseId);
    toast.success("Вопросы сохранены", { description: `${quiz.title} · ${saved.length} вопросов` });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-2xl"
      title={`Вопросы: ${quiz.title}`}
      description="Студенты видят вопросы без правильных ответов и подсказок. Ответ проверяется сразу и меняет освоение навыков."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={save} disabled={pending || isLoading}>
            {pending ? "Сохраняем…" : `Сохранить · ${questions.length}`}
          </Button>
        </>
      }
    >
      <DataState loading={isLoading} error={loadError} empty={false}>
        <ol className="space-y-4">
          {questions.map((q, i) => (
            <li key={i} className="rounded-xl bg-muted/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">Вопрос {i + 1}</span>
                <Select
                  aria-label={`Тип вопроса ${i + 1}`}
                  className="ml-auto h-8 text-xs"
                  value={q.type}
                  onChange={(e) => {
                    const next = blank(e.target.value as QuizQuestion["type"]);
                    update(i, { ...next, text: q.text, id: q.id });
                  }}
                >
                  {(Object.keys(typeLabel) as QuizQuestion["type"][]).map((t) => (
                    <option key={t} value={t}>
                      {typeLabel[t]}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(i)}
                  aria-label={`Удалить вопрос ${i + 1}`}
                  title="Удалить вопрос"
                >
                  <Trash2 size={16} aria-hidden />
                </Button>
              </div>
              <Textarea
                aria-label={`Текст вопроса ${i + 1}`}
                rows={2}
                placeholder="Текст вопроса"
                value={q.text}
                onChange={(e) => update(i, { text: e.target.value })}
              />

              {q.type === "mcq" && (
                <fieldset className="mt-3 space-y-2">
                  <legend className="mb-1 text-xs text-muted-foreground">Отметьте правильный вариант</legend>
                  {(q.options ?? []).map((opt, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${i}`}
                        checked={q.correct === k}
                        onChange={() => update(i, { correct: k })}
                        aria-label={`Вариант ${k + 1} правильный`}
                        className="size-4 shrink-0 accent-success"
                      />
                      <Input
                        aria-label={`Вариант ${k + 1}`}
                        placeholder={`Вариант ${k + 1}`}
                        value={opt}
                        onChange={(e) =>
                          update(i, { options: q.options!.map((o, m) => (m === k ? e.target.value : o)) })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={(q.options?.length ?? 0) <= 2}
                        onClick={() =>
                          update(i, {
                            options: q.options!.filter((_, m) => m !== k),
                            correct:
                              typeof q.correct === "number" && q.correct >= k && q.correct > 0
                                ? q.correct - 1
                                : q.correct,
                          })
                        }
                        aria-label={`Убрать вариант ${k + 1}`}
                      >
                        <X size={15} aria-hidden />
                      </Button>
                    </div>
                  ))}
                  {(q.options?.length ?? 0) < 8 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => update(i, { options: [...(q.options ?? []), ""] })}
                    >
                      <Plus size={14} aria-hidden /> Вариант
                    </Button>
                  )}
                </fieldset>
              )}

              {q.type === "boolean" && (
                <fieldset className="mt-3 flex gap-5 text-sm">
                  <legend className="sr-only">Правильный ответ</legend>
                  {[true, false].map((val) => (
                    <label key={String(val)} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name={`bool-${i}`}
                        checked={q.correct === val}
                        onChange={() => update(i, { correct: val })}
                        className="size-4 accent-success"
                      />
                      {val ? "Верно" : "Неверно"}
                    </label>
                  ))}
                </fieldset>
              )}

              {q.type === "short" && (
                <Input
                  className="mt-3"
                  aria-label={`Правильный ответ на вопрос ${i + 1}`}
                  placeholder="Правильный ответ — засчитывается, если ответ студента его содержит"
                  value={typeof q.correct === "string" ? q.correct : ""}
                  onChange={(e) => update(i, { correct: e.target.value })}
                />
              )}
            </li>
          ))}
        </ol>
        {questions.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Вопросов пока нет. Добавьте первый — студенты увидят тест, когда в нём будет хотя бы один вопрос.
          </p>
        )}
        {questions.length < 50 && (
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => setDraft([...questions, blank()])}
          >
            <Plus size={16} aria-hidden /> Добавить вопрос
          </Button>
        )}
        <div className="mt-4">
          <FormError message={clientError || error} />
        </div>
      </DataState>
    </Dialog>
  );
}
