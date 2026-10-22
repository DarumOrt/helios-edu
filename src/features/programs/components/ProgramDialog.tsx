"use client";

import { useState, type FormEvent } from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";
import { Button, Dialog, Field, Input, Select, Textarea, describedBy } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import type { Course, Program } from "@/shared/types/domain";

export const ruleLabel: Record<Program["rule"], string> = {
  sequential: "Последовательно",
  "any-order": "Любой порядок",
  "by-deadline": "По срокам",
};

// Программа обучения: набор курсов. Порядок курсов — порядок, в котором их отметили.
export function ProgramDialog({
  program,
  courses,
  onClose,
}: {
  program?: Program;
  courses: Course[];
  onClose: () => void;
}) {
  const [v, setV] = useState({
    title: program?.title ?? "",
    description: program?.description ?? "",
    rule: program?.rule ?? ("sequential" as Program["rule"]),
  });
  const [chosen, setChosen] = useState<string[]>(program?.courseIds ?? []);
  const { pending, fields, error, run } = useFormSubmit();

  const toggle = (id: string) =>
    setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = { ...v, courseIds: chosen };
    const saved = await run(() =>
      program
        ? api.patch<Program>(`/api/programs/${program.id}`, body)
        : api.post<Program>("/api/programs", body),
    );
    if (!saved) return;
    await mutate((key) => typeof key === "string" && key.startsWith("/api/programs"));
    toast.success(program ? "Программа сохранена" : "Программа создана", { description: saved.title });
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      className="max-w-xl"
      title={program ? "Изменить программу" : "Новая программа обучения"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" form="program-form" disabled={pending}>
            {pending ? "Сохраняем…" : program ? "Сохранить" : "Создать"}
          </Button>
        </>
      }
    >
      <form id="program-form" onSubmit={submit} noValidate className="space-y-4">
        <Field id="pr-title" label="Название" error={fields.title}>
          <Input
            id="pr-title"
            value={v.title}
            onChange={(e) => setV({ ...v, title: e.target.value })}
            maxLength={120}
            {...describedBy("pr-title", fields.title)}
          />
        </Field>
        <Field id="pr-description" label="Описание" error={fields.description}>
          <Textarea
            id="pr-description"
            rows={2}
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            maxLength={1000}
            {...describedBy("pr-description", fields.description)}
          />
        </Field>
        <Field id="pr-rule" label="Как проходить" error={fields.rule}>
          <Select
            id="pr-rule"
            className="w-full"
            value={v.rule}
            onChange={(e) => setV({ ...v, rule: e.target.value as Program["rule"] })}
          >
            {(Object.keys(ruleLabel) as Program["rule"][]).map((r) => (
              <option key={r} value={r}>
                {ruleLabel[r]}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Курсы — в порядке прохождения</legend>
          <ul className="-mx-2 max-h-60 overflow-y-auto">
            {courses.map((c) => {
              const n = chosen.indexOf(c.id);
              return (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={n >= 0}
                      onChange={() => toggle(c.id)}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                    <span className="w-6 text-right font-mono text-xs text-muted-foreground">
                      {n >= 0 ? n + 1 : ""}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {fields.courseIds && <p className="mt-1.5 text-xs text-danger">{fields.courseIds}</p>}
        </fieldset>
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
