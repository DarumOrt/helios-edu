"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { Check, Lock, LockOpen, Pin, RotateCcw } from "lucide-react";
import { ApiError, fetcher } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/utils";
import { Badge, Button, Card, CardBody, DataState, Dialog, Field, Input, Select } from "@/shared/ui";
import type { AdaptiveDashboard, Course, LearningEvent, Skill, StudentMastery } from "@/shared/types/domain";
import { masteryPercent, teacherAdaptiveApi as tapi } from "../api";

type Student = AdaptiveDashboard["students"][number];

// Контроль адаптации: освоение навыков по ученикам. Решение преподавателя всегда важнее алгоритма.
export function AdaptivePanel({ course }: { course: Course }) {
  const key = tapi.dashboardKey(course.id);
  const { data, error, isLoading } = useSWR<AdaptiveDashboard>(key, fetcher);
  const [selected, setSelected] = useState<string | null>(null);
  const student = data?.students.find((s) => s.id === selected);

  async function toggle(enabled: boolean) {
    try {
      await tapi.setEnabled(course.id, enabled);
      await mutate(key);
      toast.success(enabled ? "Адаптивный маршрут включён" : "Материалы идут по порядку курса");
    } catch {
      toast.error("Не удалось переключить режим");
    }
  }

  return (
    <section aria-labelledby="adaptive-heading" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="adaptive-heading" className="text-base font-semibold">
            Адаптация по ученикам
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Процент — вероятность, что навык освоен (модель BKT). Нажмите на ученика, чтобы отметить навык,
            открыть закрытый или закрепить задание.
          </p>
        </div>
        {data && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={data.enabled}
              onChange={(e) => toggle(e.target.checked)}
            />
            Адаптивный маршрут
          </label>
        )}
      </div>

      <DataState
        loading={isLoading}
        error={error}
        empty={!data?.students.length}
        emptyTitle="На курсе пока нет учеников"
      >
        {data && (
          <Card>
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Ученик</th>
                    <th className="px-2 py-2 font-medium">Прогресс</th>
                    {data.skills.map((s) => (
                      <th key={s.id} className="max-w-32 px-2 py-2 font-medium" title={s.title}>
                        <span className="line-clamp-2">{s.code ?? s.title}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((st) => (
                    <tr key={st.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setSelected(st.id)}
                          className="flex items-center gap-1.5 text-left font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {st.name}
                          {st.pin && <Pin size={13} aria-label="Закреплено задание" />}
                        </button>
                      </td>
                      <td className="px-2 py-2 font-mono tabular-nums">{st.progress}%</td>
                      {data.skills.map((s) => (
                        <td key={s.id} className="px-2 py-2">
                          <MasteryCell m={st.skills[s.id]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        )}
      </DataState>

      {student && data && (
        <StudentDialog
          key={student.id}
          course={course}
          student={student}
          skills={data.skills}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

function MasteryCell({ m }: { m?: StudentMastery }) {
  if (!m) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-14 items-center justify-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums",
        m.status === "mastered" && "bg-success-soft text-success",
        m.status === "learning" && "bg-primary-soft text-primary",
        m.status === "locked" && "bg-muted text-muted-foreground",
      )}
      title={
        m.status === "locked"
          ? "Закрыт: не освоены пререквизиты"
          : m.unlockedByTeacher
            ? "Открыт преподавателем"
            : undefined
      }
    >
      {m.status === "locked" && <Lock size={11} aria-hidden />}
      {m.status === "mastered" && <Check size={11} aria-hidden />}
      {m.unlockedByTeacher && m.status !== "mastered" && <LockOpen size={11} aria-hidden />}
      {masteryPercent(m.pKnown)}
    </span>
  );
}

const eventLabel: Record<string, string> = {
  "activity.viewed": "Открыл материал",
  "activity.completed": "Завершил материал",
  "attempt.started": "Начал тест",
  "attempt.submitted": "Завершил тест",
  "answer.submitted": "Ответил на вопрос",
  "hint.requested": "Взял подсказку",
  "skill.updated": "Освоение пересчитано",
  "skill.mastered": "Навык освоен",
  "recommendation.shown": "Система посоветовала",
  "recommendation.accepted": "Принял совет",
  "recommendation.skipped": "Пропустил совет",
  "teacher.override": "Решение преподавателя",
};

function eventDetails(e: LearningEvent, skills: Skill[], title: (id?: string | null) => string | undefined) {
  const p = e.payload;
  const skill = skills.find((s) => s.id === e.skillId)?.title;
  if (e.type === "skill.updated")
    return `${skill}: ${masteryPercent(Number(p.before))} → ${masteryPercent(Number(p.after))}`;
  if (e.type === "answer.submitted") return p.isCorrect ? "верно" : "неверно";
  if (e.type === "attempt.submitted") return `${p.score} из ${p.max}`;
  if (e.type.startsWith("recommendation.") || e.type === "teacher.override")
    return String(p.reason ?? "") + (p.action ? ` (${p.action})` : "");
  return skill ?? title(e.activityId) ?? "";
}

function StudentDialog({
  course,
  student,
  skills,
  onClose,
}: {
  course: Course;
  student: Student;
  skills: Skill[];
  onClose: () => void;
}) {
  const activities = (course.sections ?? []).flatMap((s) => s.activities);
  const title = (id?: string | null) => activities.find((a) => a.id === id)?.title;
  const eventsKey = tapi.eventsKey(course.id, student.id);
  const { data: events } = useSWR<LearningEvent[]>(eventsKey, fetcher);
  const [reason, setReason] = useState("");
  const [pinTo, setPinTo] = useState(student.pin?.activityId ?? "");
  const [busy, setBusy] = useState(false);
  const [reasonError, setReasonError] = useState("");
  const reasonOk = reason.trim().length >= 3 && reason.trim().length <= 500;

  async function act(fn: () => Promise<unknown>, done: string) {
    if (!reasonOk) {
      setReasonError("Укажите причину — от 3 до 500 символов");
      return;
    }
    setBusy(true);
    setReasonError("");
    try {
      await fn();
      await Promise.all([mutate(tapi.dashboardKey(course.id)), mutate(eventsKey)]);
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof ApiError ? "Сервер отклонил действие" : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      className="max-w-2xl"
      title={student.name}
      description={`Прогресс по курсу — ${student.progress}%. Каждое действие попадает в журнал ученика.`}
    >
      <div className="space-y-5">
        <Field
          id="override-reason"
          label="Причина решения"
          error={reasonError}
          hint="Обязательно: её видно в журнале"
        >
          <Input
            id="override-reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Например: сдал на практике устно"
          />
        </Field>

        <section aria-labelledby="student-skills">
          <h3 id="student-skills" className="mb-2 text-sm font-medium">
            Навыки
          </h3>
          <ul className="space-y-2">
            {skills.map((s) => {
              const m = student.skills[s.id];
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">{s.title}</span>
                  <MasteryCell m={m} />
                  <div className="flex gap-1">
                    {m?.status !== "mastered" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () => tapi.overrideSkill(course.id, student.id, s.id, "master", reason),
                            "Навык отмечен освоенным",
                          )
                        }
                      >
                        <Check size={14} aria-hidden /> Освоен
                      </Button>
                    )}
                    {m?.status === "locked" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () => tapi.overrideSkill(course.id, student.id, s.id, "unlock", reason),
                            "Навык открыт",
                          )
                        }
                      >
                        <LockOpen size={14} aria-hidden /> Открыть
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        act(
                          () => tapi.overrideSkill(course.id, student.id, s.id, "reset", reason),
                          "Освоение сброшено",
                        )
                      }
                    >
                      <RotateCcw size={14} aria-hidden /> Сбросить
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="student-pin">
          <h3 id="student-pin" className="mb-2 text-sm font-medium">
            Закрепить задание
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Закреплённое задание ученик увидит первым в «Ваш маршрут» — раньше совета системы.
          </p>
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="Задание"
              className="min-w-0 flex-1"
              value={pinTo}
              onChange={(e) => setPinTo(e.target.value)}
            >
              <option value="">Выберите материал</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </Select>
            <Button
              disabled={busy || !pinTo}
              onClick={() => act(() => tapi.pin(course.id, student.id, pinTo, reason), "Задание закреплено")}
            >
              <Pin size={15} aria-hidden /> Закрепить
            </Button>
            {student.pin && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => act(() => tapi.pin(course.id, student.id, null, reason), "Закреп снят")}
              >
                Снять
              </Button>
            )}
          </div>
          {student.pin && (
            <p className="mt-2 text-xs text-muted-foreground">
              Сейчас закреплено: {title(student.pin.activityId)} — «{student.pin.reason}»
            </p>
          )}
        </section>

        <section aria-labelledby="student-events">
          <h3 id="student-events" className="mb-2 text-sm font-medium">
            Журнал ученика
          </h3>
          {!events?.length ? (
            <p className="text-sm text-muted-foreground">Событий пока нет</p>
          ) : (
            <ol className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <time className="shrink-0 font-mono text-xs text-muted-foreground" dateTime={e.at}>
                    {new Date(e.at).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <span>
                    <Badge tone={e.type === "teacher.override" ? "warning" : "neutral"} className="mr-1.5">
                      {eventLabel[e.type] ?? e.type}
                    </Badge>
                    <span className="text-muted-foreground">{eventDetails(e, skills, title)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Dialog>
  );
}
