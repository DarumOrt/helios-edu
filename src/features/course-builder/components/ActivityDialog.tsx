"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, Select, Textarea, describedBy } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { cn } from "@/shared/lib/utils";
import { activityIcon, activityLabel, fromLocalInput, toLocalInput } from "@/shared/lib/activity-meta";
import { ACTIVITY_FIELDS, validateActivity } from "@/shared/lib/content-validation";
import {
  BUILDER_ACTIVITY_TYPES,
  type Activity,
  type BuilderActivityType,
  type Section,
} from "@/shared/types/domain";
import { builderApi, refreshCourse, type ActivityPayload } from "../api";

const typeHint: Record<BuilderActivityType, string> = {
  video: "Просмотр отслеживается: перемотка не засчитывается",
  pdf: "Засчитывается, когда студент откроет 80% страниц",
  presentation: "Засчитывается, когда студент пролистает 80% слайдов",
  quiz: "Вопросы добавите сразу после создания",
  assignment: "Студент сдаёт ответ, вы проверяете в «Проверке работ»",
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));

// Создание и правка материала. Тип выбирается при создании и потом не меняется.
export function ActivityDialog({
  open,
  onClose,
  courseId,
  sections,
  sectionId,
  activity,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  sections: Section[];
  /** модуль, куда добавляем (создание) или где лежит материал (правка) */
  sectionId: string;
  activity?: Activity;
}) {
  const editing = Boolean(activity);
  const [type, setType] = useState<BuilderActivityType>(
    (activity?.type as BuilderActivityType | undefined) ?? "video",
  );
  const [v, setV] = useState({
    title: activity?.title ?? "",
    src: activity?.src ?? "",
    pages: activity?.pages?.toString() ?? "",
    durationMin: activity?.durationMin?.toString() ?? "",
    due: toLocalInput(activity?.due),
    description: activity?.description ?? "",
    maxGrade: activity?.maxGrade?.toString() ?? (activity ? "" : "100"),
    sectionId,
  });
  const { pending, fields, error, run, setFields } = useFormSubmit();
  const has = (k: string) => (ACTIVITY_FIELDS[type] as string[]).includes(k);
  const set = (key: keyof typeof v, value: string) => setV((x) => ({ ...x, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const all: ActivityPayload = {
      title: v.title,
      src: v.src || null,
      pages: num(v.pages),
      durationMin: num(v.durationMin),
      due: fromLocalInput(v.due),
      description: v.description || null,
      maxGrade: num(v.maxGrade),
    };
    // только поля этого типа — как и на сервере
    const payload = Object.fromEntries(Object.entries(all).filter(([k]) => has(k))) as ActivityPayload;
    const clientErrors = validateActivity(editing ? payload : { ...payload, type }, editing);
    if (Object.keys(clientErrors).length) {
      setFields(clientErrors);
      return;
    }
    const saved = await run(() =>
      activity
        ? builderApi.updateActivity(courseId, activity.id, {
            ...payload,
            ...(v.sectionId !== sectionId && { sectionId: v.sectionId }),
          })
        : builderApi.addActivity(courseId, sectionId, { ...payload, type }),
    );
    if (!saved) return;
    await refreshCourse(courseId);
    toast.success(editing ? "Материал сохранён" : `${activityLabel[type]} добавлен(а)`, {
      description: saved.title,
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-xl"
      title={editing ? "Изменить материал" : "Добавить материал"}
      description={editing ? activityLabel[type] : typeHint[type]}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" form="activity-form" disabled={pending}>
            {pending ? "Сохраняем…" : editing ? "Сохранить" : "Добавить"}
          </Button>
        </>
      }
    >
      <form id="activity-form" onSubmit={submit} noValidate className="space-y-4">
        {!editing && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Что добавить</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {BUILDER_ACTIVITY_TYPES.map((t) => {
                const Icon = activityIcon[t];
                return (
                  <label
                    key={t}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-center text-xs font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                      type === t
                        ? "border-primary bg-primary-soft text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="activity-type"
                      value={t}
                      checked={type === t}
                      onChange={() => setType(t)}
                      className="sr-only"
                    />
                    <Icon size={20} aria-hidden />
                    {activityLabel[t].replace(" (PDF)", "")}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <Field id="act-title" label="Название" error={fields.title}>
          <Input
            id="act-title"
            value={v.title}
            onChange={(e) => set("title", e.target.value)}
            disabled={pending}
            maxLength={120}
            {...describedBy("act-title", fields.title)}
          />
        </Field>

        {has("src") && (
          <Field
            id="act-src"
            label={type === "video" ? "Ссылка на видеофайл" : "Ссылка на файл (необязательно)"}
            error={fields.src}
            hint={
              type === "video" ? "MP4 по прямой ссылке https://… или путь /media/lesson-matan.mp4" : undefined
            }
          >
            <Input
              id="act-src"
              inputMode="url"
              className="font-mono"
              value={v.src}
              onChange={(e) => set("src", e.target.value)}
              disabled={pending}
              {...describedBy("act-src", fields.src, type === "video")}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {has("pages") && (
            <Field
              id="act-pages"
              label={type === "presentation" ? "Слайдов" : "Страниц"}
              error={fields.pages}
            >
              <Input
                id="act-pages"
                type="number"
                min={1}
                max={500}
                value={v.pages}
                onChange={(e) => set("pages", e.target.value)}
                disabled={pending}
                {...describedBy("act-pages", fields.pages)}
              />
            </Field>
          )}
          {has("durationMin") && (
            <Field
              id="act-duration"
              label={type === "video" ? "Длительность, мин" : "Примерное время, мин"}
              error={fields.durationMin}
            >
              <Input
                id="act-duration"
                type="number"
                min={1}
                max={600}
                value={v.durationMin}
                onChange={(e) => set("durationMin", e.target.value)}
                disabled={pending}
                {...describedBy("act-duration", fields.durationMin)}
              />
            </Field>
          )}
          {has("due") && (
            <Field id="act-due" label="Срок сдачи" error={fields.due} hint="Пусто — без срока">
              <Input
                id="act-due"
                type="datetime-local"
                value={v.due}
                onChange={(e) => set("due", e.target.value)}
                disabled={pending}
                {...describedBy("act-due", fields.due, true)}
              />
            </Field>
          )}
          {has("maxGrade") && (
            <Field id="act-max" label="Оценка из" error={fields.maxGrade}>
              <Input
                id="act-max"
                type="number"
                min={1}
                max={1000}
                value={v.maxGrade}
                onChange={(e) => set("maxGrade", e.target.value)}
                disabled={pending}
                {...describedBy("act-max", fields.maxGrade)}
              />
            </Field>
          )}
        </div>

        {has("description") && (
          <Field
            id="act-description"
            label="Условие"
            error={fields.description}
            hint="Что нужно сделать и как оформить"
          >
            <Textarea
              id="act-description"
              rows={4}
              value={v.description}
              onChange={(e) => set("description", e.target.value)}
              disabled={pending}
              maxLength={4000}
              {...describedBy("act-description", fields.description, true)}
            />
          </Field>
        )}

        {editing && sections.length > 1 && (
          <Field id="act-section" label="Модуль">
            <Select
              id="act-section"
              className="w-full"
              value={v.sectionId}
              onChange={(e) => set("sectionId", e.target.value)}
              disabled={pending}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.order}. {s.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
