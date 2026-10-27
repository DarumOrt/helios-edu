"use client";

import { useState, type FormEvent } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { ClipboardPaste, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { ApiError, fetcher } from "@/shared/lib/api-client";
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataState,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
  describedBy,
} from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import type { Activity, Course, Skill } from "@/shared/types/domain";
import { teacherAdaptiveApi as tapi } from "../api";

// Навыки курса (P5): что проверяет каждое задание. Без разметки система сама заводит навык на модуль.
export function SkillsEditor({ course }: { course: Course }) {
  const key = tapi.skillsKey(course.id);
  const { data, error, isLoading } = useSWR<Skill[]>(key, fetcher);
  const [editing, setEditing] = useState<Skill | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const activities = (course.sections ?? []).flatMap((s) => s.activities);
  const sectionTitle = (id?: string | null) => course.sections?.find((s) => s.id === id)?.title;
  const skillTitle = (id: string) => data?.find((s) => s.id === id)?.title ?? id;

  async function remove(skill: Skill) {
    if (!window.confirm(`Удалить навык «${skill.title}»?`)) return;
    try {
      await tapi.deleteSkill(course.id, skill.id);
      await mutate(key);
      toast.success("Навык удалён");
    } catch (e) {
      // по навыку уже есть результаты учеников — удалить нельзя
      toast.error(
        e instanceof ApiError && e.status === 409
          ? "По навыку уже есть результаты учеников"
          : "Не удалось удалить навык",
      );
    }
  }

  return (
    <section aria-labelledby="skills-heading" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="skills-heading" className="text-base font-semibold">
            Навыки курса
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Навык — что ученик должен уметь (из РПД). Тесты меняют освоение навыков, а система советует, что
            делать дальше. Навык закрыт, пока не освоены его пререквизиты.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}>
            <ClipboardPaste size={16} aria-hidden /> Вставить из РПД
          </Button>
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> Навык
          </Button>
        </div>
      </div>

      <DataState loading={isLoading} error={error} empty={!data?.length} emptyTitle="Навыков пока нет">
        <ul className="space-y-2">
          {data?.map((s) => (
            <li key={s.id}>
              <Card>
                <CardBody className="flex flex-wrap items-start gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium">
                      {s.code && (
                        <span className="mr-2 font-mono text-xs text-muted-foreground">{s.code}</span>
                      )}
                      {s.title}
                      {s.isAuto && (
                        <Badge tone="outline" className="ml-2 align-middle">
                          <Wand2 size={12} aria-hidden /> авто
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        sectionTitle(s.sectionId),
                        s.prerequisiteIds.length && `после: ${s.prerequisiteIds.map(skillTitle).join(", ")}`,
                        s.activityIds.length &&
                          `материалы: ${s.activityIds
                            .map((id) => activities.find((a) => a.id === id)?.title ?? id)
                            .join(", ")}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(s)}
                      aria-label={`Изменить «${s.title}»`}
                    >
                      <Pencil size={16} aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(s)}
                      aria-label={`Удалить «${s.title}»`}
                    >
                      <Trash2 size={16} aria-hidden />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </DataState>

      {editing && (
        <SkillDialog
          key={editing === "new" ? "new" : editing.id}
          course={course}
          skill={editing === "new" ? undefined : editing}
          skills={data ?? []}
          activities={activities}
          onClose={() => setEditing(null)}
        />
      )}
      {importing && <ImportDialog course={course} onClose={() => setImporting(false)} />}
    </section>
  );
}

function SkillDialog({
  course,
  skill,
  skills,
  activities,
  onClose,
}: {
  course: Course;
  skill?: Skill;
  skills: Skill[];
  activities: Activity[];
  onClose: () => void;
}) {
  const [values, setValues] = useState({
    title: skill?.title ?? "",
    code: skill?.code ?? "",
    description: skill?.description ?? "",
    sectionId: skill?.sectionId ?? course.sections?.[0]?.id ?? "",
    prerequisiteIds: skill?.prerequisiteIds ?? [],
    activityIds: skill?.activityIds ?? [],
  });
  const { pending, fields, error, run } = useFormSubmit();
  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) =>
    setValues((x) => ({ ...x, [k]: v }));
  const toggle = (k: "prerequisiteIds" | "activityIds", id: string) =>
    set(k, values[k].includes(id) ? values[k].filter((x) => x !== id) : [...values[k], id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      title: values.title,
      code: values.code || null,
      description: values.description || null,
      sectionId: values.sectionId || null,
      prerequisiteIds: values.prerequisiteIds,
    };
    const saved = await run(async () => {
      const result = skill
        ? await tapi.updateSkill(course.id, skill.id, payload)
        : await tapi.createSkill(course.id, payload);
      // привязки хранятся по материалу: у каждого изменённого материала — полный список его навыков
      const before = new Set(skill?.activityIds ?? []);
      const after = new Set(values.activityIds);
      for (const a of activities) {
        if (before.has(a.id) === after.has(a.id)) continue;
        const others = skills
          .filter((s) => s.id !== result.id && s.activityIds.includes(a.id))
          .map((s) => s.id);
        await tapi.linkSkills(course.id, a.id, after.has(a.id) ? [...others, result.id] : others);
      }
      return result;
    });
    if (!saved) return;
    await mutate(tapi.skillsKey(course.id));
    toast.success(skill ? "Навык сохранён" : "Навык добавлен");
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      className="max-w-xl"
      title={skill ? "Навык" : "Новый навык"}
      description="Формулируйте как результат обучения: «Уметь…», «Различать…»."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" form="skill-form" disabled={pending}>
            {pending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </>
      }
    >
      <form id="skill-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field id="skill-code" label="Код" error={fields.code} hint="ОПК-1.2">
            <Input
              id="skill-code"
              value={values.code}
              maxLength={20}
              onChange={(e) => set("code", e.target.value)}
              {...describedBy("skill-code", fields.code, true)}
            />
          </Field>
          <Field id="skill-title" label="Навык" error={fields.title}>
            <Input
              id="skill-title"
              value={values.title}
              maxLength={200}
              onChange={(e) => set("title", e.target.value)}
              {...describedBy("skill-title", fields.title)}
            />
          </Field>
        </div>
        <Field id="skill-section" label="Модуль" error={fields.sectionId}>
          <Select
            id="skill-section"
            className="w-full"
            value={values.sectionId}
            onChange={(e) => set("sectionId", e.target.value)}
          >
            <option value="">Без модуля</option>
            {course.sections?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="skill-description" label="Описание" error={fields.description}>
          <Textarea
            id="skill-description"
            rows={2}
            maxLength={1000}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <CheckList
          legend="Сначала освоить"
          error={fields.prerequisiteIds}
          items={skills.filter((s) => s.id !== skill?.id).map((s) => ({ id: s.id, label: s.title }))}
          checked={values.prerequisiteIds}
          onToggle={(id) => toggle("prerequisiteIds", id)}
          empty="Других навыков пока нет"
        />
        <CheckList
          legend="Материалы, которые развивают навык"
          error={fields.skillIds}
          items={activities.map((a) => ({ id: a.id, label: a.title }))}
          checked={values.activityIds}
          onToggle={(id) => toggle("activityIds", id)}
          empty="В курсе пока нет материалов"
        />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}

function CheckList({
  legend,
  items,
  checked,
  onToggle,
  error,
  empty,
}: {
  legend: string;
  items: { id: string; label: string }[];
  checked: string[];
  onToggle: (id: string) => void;
  error?: string;
  empty: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      {items.length ? (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
          {items.map((it) => (
            <label
              key={it.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={checked.includes(it.id)}
                onChange={() => onToggle(it.id)}
              />
              {it.label}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </fieldset>
  );
}

function ImportDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const [text, setText] = useState("");
  const [sectionId, setSectionId] = useState(course.sections?.[0]?.id ?? "");
  const { pending, fields, error, run } = useFormSubmit();
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const created = await run(() => tapi.importSkills(course.id, text, sectionId || null));
    if (!created) return;
    await mutate(tapi.skillsKey(course.id));
    toast.success(`Добавлено навыков: ${created.length}`);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      className="max-w-xl"
      title="Навыки из РПД"
      description="Вставьте список компетенций — по одной на строку. Код в начале строки распознаётся: «ОПК-1.2 Уметь…»."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" form="import-form" disabled={pending || !lines}>
            {pending ? "Добавляем…" : `Добавить · ${lines}`}
          </Button>
        </>
      }
    >
      <form id="import-form" onSubmit={submit} className="space-y-4">
        <Field id="import-text" label="Компетенции" error={fields.text} hint="До 50 строк">
          <Textarea
            id="import-text"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"ОПК-1.1 Различать виды цифровых ресурсов\nОПК-1.2 Применять инструменты ИИ"}
          />
        </Field>
        <Field id="import-section" label="Модуль" error={fields.sectionId}>
          <Select
            id="import-section"
            className="w-full"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">Без модуля</option>
            {course.sections?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>
        {/* ошибки строк приходят как lines.N — показываем первую */}
        <FormError message={error || Object.values(fields)[0] || ""} />
      </form>
    </Dialog>
  );
}
