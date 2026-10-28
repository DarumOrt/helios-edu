"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, ClipboardList, Lightbulb, RotateCcw, Trophy, XCircle } from "lucide-react";
import { ApiError, fetcher } from "@/shared/lib/api-client";
import { Badge, Button, Card, CardBody, DataState, Progress, buttonVariants } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { useSession } from "@/shared/auth/session";
import { newSessionId } from "@/shared/lib/tracking/tracker";
import type {
  AdaptiveQuestion,
  AnswerResult,
  AttemptResult,
  AttemptStart,
  AttemptsSummary,
  HintResult,
  Skill,
} from "@/shared/types/domain";
import { adaptiveApi, adaptiveKeys, masteryPercent } from "../api";
import { AnswerInput } from "./AnswerInput";

interface QuestionState {
  draft?: unknown;
  hints: HintResult[];
  result?: AnswerResult;
  error?: string;
}

// Адаптивный тест: ответ проверяется сразу, видно, как меняется освоение навыков; подсказки — по запросу.
// Новая попытка начинается только кнопкой (открытие страницы её не тратит); начатую — продолжаем сразу.
export function AdaptiveQuiz({ courseId, activityId }: { courseId: string; activityId: string }) {
  const summaryKey = adaptiveKeys.attempts(courseId, activityId);
  const { data: summary, error: summaryError } = useSWR<AttemptsSummary>(summaryKey, fetcher);
  // round меняет ключ — «пройти ещё раз» начинает новую попытку
  const [round, setRound] = useState(0);
  const [started, setStarted] = useState(false);
  const {
    data: attempt,
    error,
    isLoading,
  } = useSWR<AttemptStart>(
    started || summary?.open ? ["attempt", courseId, activityId, round] : null,
    () => adaptiveApi.startAttempt(courseId, activityId),
    { revalidateOnFocus: false, revalidateIfStale: false, shouldRetryOnError: false },
  );
  const { data: skills } = useSWR<Skill[]>(`/api/courses/${encodeURIComponent(courseId)}/skills`, fetcher);
  const user = useSession((s) => s.user);
  const [state, setState] = useState<Record<string, QuestionState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [finished, setFinished] = useState<AttemptResult | null>(null);
  // завершение с пропущенными вопросами — только после подтверждения
  const [confirming, setConfirming] = useState(false);

  const questions = attempt?.questions ?? [];
  const answered = questions.filter((q) => state[q.id]?.result).length;
  const skillTitle = (id: string) => skills?.find((s) => s.id === id)?.title ?? "Навык";
  const patch = (id: string, p: Partial<QuestionState>) =>
    setState((s) => ({ ...s, [id]: { ...(s[id] ?? { hints: [] }), ...p } }));

  const refreshRoute = () =>
    Promise.all([mutate(adaptiveKeys.progress(courseId)), mutate(adaptiveKeys.next(courseId))]);

  async function check(q: AdaptiveQuestion) {
    if (!attempt) return;
    setBusy(q.id);
    try {
      const result = await adaptiveApi.answer(attempt.attemptId, q.id, state[q.id]?.draft);
      patch(q.id, { result, error: undefined });
      void refreshRoute();
    } catch (e) {
      patch(q.id, {
        error:
          e instanceof ApiError && e.status === 409 ? "Ответ уже сохранён" : "Не удалось проверить ответ",
      });
    } finally {
      setBusy(null);
    }
  }

  async function takeHint(q: AdaptiveQuestion) {
    if (!attempt) return;
    setBusy(q.id);
    try {
      const hint = await adaptiveApi.hint(attempt.attemptId, q.id);
      patch(q.id, { hints: [...(state[q.id]?.hints ?? []), hint] });
    } catch {
      toast.error("Подсказок больше нет");
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    if (!attempt) return;
    if (answered < questions.length && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setBusy("submit");
    try {
      const result = await adaptiveApi.submit(attempt.attemptId);
      setFinished(result);
      // результат теста — и в рейтинг группы (трекинг), как раньше
      void fetch("/api/tracking/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          sessionId: newSessionId(),
          userId: user.id,
          activityId,
          activityType: "quiz",
          coverage: result.percent,
          activeTimeSec: 0,
          completed: true,
        }),
      }).catch(() => undefined);
      void refreshRoute();
      void mutate(summaryKey);
    } catch {
      toast.error("Не удалось завершить тест");
    } finally {
      setBusy(null);
    }
  }

  function again() {
    setState({});
    setFinished(null);
    setStarted(true);
    setRound((r) => r + 1);
  }

  const left = summary?.maxAttempts == null ? null : summary.maxAttempts - summary.used;
  if (finished)
    return (
      <QuizResult
        result={finished}
        courseId={courseId}
        left={left}
        onAgain={left === 0 ? undefined : again}
      />
    );
  if (!started && !summary?.open)
    return (
      <DataState loading={!summary && !summaryError} error={summaryError}>
        {summary && <QuizStart summary={summary} left={left} onStart={again} />}
      </DataState>
    );

  return (
    <DataState
      loading={isLoading}
      error={error}
      empty={!isLoading && !questions.length}
      emptyTitle="В тесте пока нет вопросов — преподаватель скоро их добавит"
    >
      <div className="space-y-4">
        <Card>
          <CardBody className="py-3">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Отвечено</span>
              <span className="text-muted-foreground tabular-nums">
                {answered} из {questions.length}
              </span>
            </div>
            <Progress value={questions.length ? (answered / questions.length) * 100 : 0} />
            <p className="mt-2 text-xs text-muted-foreground">
              Ответ проверяется сразу. Подсказка помогает, но такой ответ не повышает освоение навыка.
            </p>
          </CardBody>
        </Card>

        {questions.map((q, idx) => {
          const s = state[q.id] ?? { hints: [] };
          const hintsLeft = (q.hintsCount ?? 0) - s.hints.length;
          const done = Boolean(s.result);
          return (
            <Card
              key={q.id}
              className={cn(
                done && (s.result!.isCorrect ? "ring-1 ring-success/40" : "ring-1 ring-danger/40"),
              )}
            >
              <CardBody>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft text-xs font-semibold text-primary">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Вопрос {idx + 1} из {questions.length}
                  </span>
                  {q.skillId && (
                    <Badge tone="outline" className="ml-auto max-w-full truncate">
                      {skillTitle(q.skillId)}
                    </Badge>
                  )}
                </div>
                <div className="mb-4 text-base font-medium">{q.text}</div>

                <AnswerInput
                  question={q}
                  value={s.draft}
                  disabled={done || busy === q.id}
                  onChange={(draft) => patch(q.id, { draft })}
                  correct={s.result?.correct}
                />

                {s.hints.length > 0 && (
                  <ol className="mt-3 space-y-1.5">
                    {s.hints.map((h) => (
                      <li key={h.level} className="flex gap-2 rounded-md bg-sun-soft px-3 py-2 text-sm">
                        <Lightbulb size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                        <span>
                          <span className="font-medium">Подсказка {h.level}.</span> {h.text}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {s.result && (
                  <Feedback result={s.result} skillTitle={skillTitle} hinted={s.hints.length > 0} />
                )}
                {s.error && (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {s.error}
                  </p>
                )}

                {!done && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() => check(q)}
                      disabled={s.draft === undefined || s.draft === "" || busy !== null}
                    >
                      Проверить
                    </Button>
                    {hintsLeft > 0 && (
                      <Button variant="ghost" onClick={() => takeHint(q)} disabled={busy !== null}>
                        <Lightbulb size={16} aria-hidden /> Подсказка · осталось {hintsLeft}
                      </Button>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}

        <div className="sticky bottom-4 flex flex-col items-end gap-2">
          {confirming && (
            <p
              role="alert"
              className="rounded-md bg-warning-soft px-4 py-2 text-sm text-warning shadow-elevate"
            >
              Без ответа {questions.length - answered} из {questions.length} — они засчитаются как неверные.
              Завершить?
            </p>
          )}
          <div className="flex gap-2">
            {confirming && (
              <Button variant="outline" onClick={() => setConfirming(false)} className="shadow-elevate">
                Продолжить тест
              </Button>
            )}
            <Button onClick={finish} disabled={busy !== null} size="lg" className="shadow-elevate">
              {busy === "submit"
                ? "Завершаем…"
                : confirming
                  ? "Да, завершить"
                  : answered < questions.length
                    ? "Завершить досрочно"
                    : "Завершить тест"}
            </Button>
          </div>
        </div>
      </div>
    </DataState>
  );
}

function Feedback({
  result,
  skillTitle,
  hinted,
}: {
  result: AnswerResult;
  skillTitle: (id: string) => string;
  hinted: boolean;
}) {
  return (
    <div aria-live="polite" className="mt-4 space-y-2">
      <p
        className={cn(
          "flex items-center gap-2 text-sm font-medium",
          result.isCorrect ? "text-success" : "text-danger",
        )}
      >
        {result.isCorrect ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}
        {result.isCorrect ? (hinted ? "Верно, с подсказкой" : "Верно") : "Неверно"}
      </p>
      {result.skills.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {result.skills.map((c) => (
            <li
              key={c.skillId}
              className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground"
              title="Вероятность, что навык освоен (модель BKT)"
            >
              {skillTitle(c.skillId)}: {masteryPercent(c.before)} → {masteryPercent(c.after)}
              {c.status === "mastered" && " · освоен"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const attemptsLeft = (left: number | null) =>
  left == null ? "Попыток — без ограничения" : left > 0 ? `Осталось попыток: ${left}` : "Попытки закончились";

function QuizStart({
  summary,
  left,
  onStart,
}: {
  summary: AttemptsSummary;
  left: number | null;
  onStart: () => void;
}) {
  return (
    <Card>
      <CardBody className="py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <ClipboardList size={24} aria-hidden />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {attemptsLeft(left)}
          {summary.used > 0 && ` · завершено: ${summary.used}`}
        </p>
        {summary.bestPercent != null && (
          <p className="mt-1 text-sm">
            Лучший результат: <span className="font-mono font-semibold">{summary.bestPercent}%</span> — он
            идёт в оценку
          </p>
        )}
        <Button className="mt-6" size="lg" onClick={onStart} disabled={left === 0}>
          {left === 0 ? "Попытки закончились" : summary.used > 0 ? "Начать заново" : "Начать тест"}
        </Button>
      </CardBody>
    </Card>
  );
}

function QuizResult({
  result,
  courseId,
  onAgain,
  left,
}: {
  result: AttemptResult;
  courseId: string;
  /** нет — попытки закончились */
  onAgain?: () => void;
  /** сколько попыток осталось (сводка обновляется после завершения); null — без ограничения */
  left: number | null;
}) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
          <Trophy size={28} aria-hidden />
        </div>
        <div className="mt-4 text-sm text-muted-foreground">Тест завершён</div>
        <div className="mt-2 text-5xl font-bold tabular-nums">
          {result.score}
          <span className="text-2xl text-muted-foreground"> / {result.max}</span>
        </div>
        <Badge tone={result.percent >= 80 ? "success" : "warning"} className="mt-3">
          {result.percent}%
        </Badge>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={`/courses/${courseId}`} className={buttonVariants()}>
            Что дальше <ArrowRight size={16} aria-hidden />
          </Link>
          {onAgain && (
            <Button variant="outline" onClick={onAgain}>
              <RotateCcw size={16} aria-hidden /> Пройти ещё раз
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{attemptsLeft(left)}</p>
      </CardBody>
    </Card>
  );
}
