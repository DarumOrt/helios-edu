"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, Dialog, EmptyState, Field, Input, describedBy } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { activityIcon, activityLabel } from "@/shared/lib/activity-meta";
import { apiErrorInfo } from "@/shared/lib/api-client";
import { formatDateTime } from "@/shared/lib/format";
import { validateSection } from "@/shared/lib/content-validation";
import type { Activity, Course, Section } from "@/shared/types/domain";
import { builderApi, refreshCourse } from "../api";
import { ActivityDialog } from "./ActivityDialog";
import { QuestionsDialog } from "./QuestionsDialog";

type Modal =
  | { kind: "section"; section?: Section }
  | { kind: "activity"; sectionId: string; activity?: Activity }
  | { kind: "questions"; quiz: Activity }
  | { kind: "delete-section"; section: Section }
  | { kind: "delete-activity"; activity: Activity };

const swap = <T,>(list: T[], i: number, j: number) => {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

// Конструктор курса: модули и материалы. Изменения сохраняются сразу, по одному действию.
export function CourseBuilder({ course }: { course: Course }) {
  const sections = course.sections ?? [];
  const [modal, setModal] = useState<Modal | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => setModal(null);

  // короткие действия (перестановка, удаление) — с ошибкой в тосте
  async function act(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await action();
      await refreshCourse(course.id);
      if (success) toast.success(success);
      return true;
    } catch (failure) {
      const info = apiErrorInfo(failure);
      toast.error(
        info.status === 501
          ? "На сервере конструктор ещё не подключён"
          : (info.error ?? "Не удалось сохранить"),
        {
          description:
            info.status === 501 ? "Переключитесь на «Демо» или дождитесь обновления бэкенда" : undefined,
        },
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  const moveSection = (i: number, dir: -1 | 1) =>
    act(() =>
      builderApi.orderSections(
        course.id,
        swap(sections, i, i + dir).map((s) => s.id),
      ),
    );
  const moveActivity = (section: Section, i: number, dir: -1 | 1) =>
    act(() =>
      builderApi.orderActivities(
        course.id,
        section.id,
        swap(section.activities, i, i + dir).map((a) => a.id),
      ),
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Изменения сохраняются сразу. Студенты видят курс, когда он опубликован и закреплён за их группой.
      </p>

      {sections.length === 0 && (
        <EmptyState
          icon={Plus}
          title="В курсе пока нет модулей"
          description="Начните с первого модуля — например, «Введение»"
        />
      )}

      {sections.map((section, si) => (
        <Card key={section.id} className="overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft font-mono text-xs font-semibold text-primary">
              {section.order}
            </span>
            <h3 className="min-w-0 flex-1 truncate font-semibold">{section.title}</h3>
            <IconAction label="Переименовать модуль" onClick={() => setModal({ kind: "section", section })}>
              <Pencil size={15} />
            </IconAction>
            <IconAction label="Выше" disabled={busy || si === 0} onClick={() => moveSection(si, -1)}>
              <ArrowUp size={15} />
            </IconAction>
            <IconAction
              label="Ниже"
              disabled={busy || si === sections.length - 1}
              onClick={() => moveSection(si, 1)}
            >
              <ArrowDown size={15} />
            </IconAction>
            <IconAction
              label={
                section.activities.length ? "Сначала удалите или перенесите материалы" : "Удалить модуль"
              }
              disabled={busy || section.activities.length > 0}
              onClick={() => setModal({ kind: "delete-section", section })}
              danger
            >
              <Trash2 size={15} />
            </IconAction>
          </div>

          <ul className="divide-y border-t">
            {section.activities.map((a, ai) => {
              const Icon = activityIcon[a.type];
              const meta = [
                activityLabel[a.type],
                a.pages && `${a.pages} стр.`,
                a.durationMin && `${a.durationMin} мин`,
                a.maxGrade && `из ${a.maxGrade}`,
                a.maxAttempts && `попыток: ${a.maxAttempts}`,
              ].filter(Boolean);
              return (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {meta.join(" · ")}
                      {a.due && (
                        <>
                          {" · до "}
                          <span className="font-mono">{formatDateTime(a.due)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {a.type === "quiz" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModal({ kind: "questions", quiz: a })}
                    >
                      <ListChecks size={14} aria-hidden /> Вопросы
                    </Button>
                  )}
                  <IconAction
                    label="Изменить материал"
                    onClick={() => setModal({ kind: "activity", sectionId: section.id, activity: a })}
                    disabled={!["video", "pdf", "presentation", "quiz", "assignment"].includes(a.type)}
                  >
                    <Pencil size={15} />
                  </IconAction>
                  <IconAction
                    label="Выше"
                    disabled={busy || ai === 0}
                    onClick={() => moveActivity(section, ai, -1)}
                  >
                    <ArrowUp size={15} />
                  </IconAction>
                  <IconAction
                    label="Ниже"
                    disabled={busy || ai === section.activities.length - 1}
                    onClick={() => moveActivity(section, ai, 1)}
                  >
                    <ArrowDown size={15} />
                  </IconAction>
                  <IconAction
                    label="Удалить материал"
                    disabled={busy}
                    onClick={() => setModal({ kind: "delete-activity", activity: a })}
                    danger
                  >
                    <Trash2 size={15} />
                  </IconAction>
                </li>
              );
            })}
            <li className="px-5 py-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setModal({ kind: "activity", sectionId: section.id })}
              >
                <Plus size={14} aria-hidden /> Материал
              </Button>
            </li>
          </ul>
        </Card>
      ))}

      <button
        type="button"
        onClick={() => setModal({ kind: "section" })}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
      >
        <Plus size={16} aria-hidden /> Модуль
      </button>

      {modal?.kind === "section" && (
        <SectionDialog courseId={course.id} section={modal.section} onClose={close} />
      )}
      {modal?.kind === "activity" && (
        <ActivityDialog
          open
          onClose={close}
          courseId={course.id}
          sections={sections}
          sectionId={modal.sectionId}
          activity={modal.activity}
        />
      )}
      {modal?.kind === "questions" && (
        <QuestionsDialog open onClose={close} courseId={course.id} quiz={modal.quiz} />
      )}
      {(modal?.kind === "delete-section" || modal?.kind === "delete-activity") && (
        <Dialog
          open
          onClose={close}
          title={
            modal.kind === "delete-section"
              ? `Удалить модуль «${modal.section.title}»?`
              : `Удалить «${modal.activity.title}»?`
          }

          footer={
            <>
              <Button variant="ghost" onClick={close} disabled={busy}>
                Отмена
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  const ok = await act(
                    () =>
                      modal.kind === "delete-section"
                        ? builderApi.deleteSection(course.id, modal.section.id)
                        : builderApi.deleteActivity(course.id, modal.activity.id),
                    modal.kind === "delete-section" ? "Модуль удалён" : "Материал удалён",
                  );
                  if (ok) close();
                }}
              >
                {busy ? "Удаляем…" : "Удалить"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">
            {modal.kind === "delete-section"
              ? "Модуль пустой — ничего, кроме него, не удалится."
              : "Прогресс студентов по этому материалу перестанет учитываться."}
          </p>
        </Dialog>
      )}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        danger ? "text-muted-foreground hover:bg-danger-soft hover:text-danger" : "text-muted-foreground"
      }
    >
      {children}
    </Button>
  );
}

function SectionDialog({
  courseId,
  section,
  onClose,
}: {
  courseId: string;
  section?: Section;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(section?.title ?? "");
  const { pending, fields, error, run, setFields } = useFormSubmit();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clientErrors = validateSection({ title });
    if (Object.keys(clientErrors).length) {
      setFields(clientErrors);
      return;
    }
    const saved = await run(() =>
      section
        ? builderApi.renameSection(courseId, section.id, title)
        : builderApi.addSection(courseId, title),
    );
    if (!saved) return;
    await refreshCourse(courseId);
    toast.success(section ? "Модуль переименован" : "Модуль добавлен", { description: saved.title });
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={section ? "Переименовать модуль" : "Новый модуль"}
      description={section ? undefined : "Модуль появится в конце курса — порядок можно поменять стрелками."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" form="section-form" disabled={pending}>
            {pending ? "Сохраняем…" : section ? "Сохранить" : "Добавить"}
          </Button>
        </>
      }
    >
      <form id="section-form" onSubmit={submit} noValidate className="space-y-4">
        <Field
          id="section-title"
          label="Название модуля"
          error={fields.title}
          hint="Например, «Модуль 3. Производная»"
        >
          <Input
            id="section-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
            maxLength={120}
            {...describedBy("section-title", fields.title, true)}
          />
        </Field>
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
