"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, Select, Textarea, describedBy } from "@/shared/ui";
import { COURSE_STATUSES, validateCourse } from "@/shared/lib/management-validation";
import { FACULTIES, currentAcademicYear } from "@/shared/lib/faculties";
import type { Course, CourseStatus, User } from "@/shared/types/domain";
import { adminApi, refreshManagement, type CoursePayload } from "../api";
import { courseStatusMeta } from "../labels";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";

const statusHint: Record<CourseStatus, string> = {
  draft: "Студенты курс не видят — можно спокойно наполнять",
  published: "Студенты групп курса видят его в кабинете",
  archived: "Курс закрыт: студенты его не видят, оценки сохраняются",
};

// Создание курса и правка его карточки. Содержание (модули, материалы) — в конструкторе курса.
export function CourseDialog({
  open,
  onClose,
  course,
  tutors,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  course?: Course;
  tutors: User[];
  categories: string[];
}) {
  const router = useRouter();
  const editing = Boolean(course);
  const [values, setValues] = useState({
    code: course?.code ?? "",
    title: course?.title ?? "",
    category: course?.category ?? "",
    description: course?.description ?? "",
    tutorId: course?.tutorId ?? tutors[0]?.id ?? "",
    faculty: course?.faculty ?? "ИНЭК",
    academicYear: course?.academicYear ?? currentAcademicYear(),
    status: (course?.status ?? "draft") as CourseStatus,
  });
  const { pending, fields, error, run, setFields } = useFormSubmit();
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { code, status, ...meta } = values;
    const payload: CoursePayload = editing ? { ...meta, status } : { ...meta, code: code.toUpperCase() };
    const clientErrors = validateCourse(payload, editing);
    if (Object.keys(clientErrors).length) {
      setFields(clientErrors);
      return;
    }
    const saved = await run(() =>
      course ? adminApi.updateCourse(course.id, payload) : adminApi.createCourse(payload),
    );
    if (!saved) return;
    await refreshManagement();
    onClose();
    if (editing) toast.success("Карточка курса сохранена", { description: saved.title });
    else
      toast.success("Курс создан черновиком", {
        description: "Опубликуйте его, когда материалы будут готовы",
        action: { label: "Открыть", onClick: () => router.push(`/courses/${saved.id}`) },
      });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Карточка курса" : "Создать курс"}
      description={
        editing
          ? `${course!.code} · код курса не меняется`
          : "Курс создаётся черновиком — студенты его пока не видят."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" form="course-form" disabled={pending}>
            {pending ? "Сохраняем…" : editing ? "Сохранить" : "Создать"}
          </Button>
        </>
      }
    >
      <form id="course-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
          <Field id="course-code" label="Код" error={fields.code} hint={editing ? undefined : "МАТ-101"}>
            <Input
              id="course-code"
              className="font-mono uppercase"
              value={values.code}
              onChange={(e) => set("code", e.target.value)}
              disabled={pending || editing}
              maxLength={10}
              {...describedBy("course-code", fields.code, !editing)}
            />
          </Field>
          <Field id="course-title" label="Название" error={fields.title}>
            <Input
              id="course-title"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              disabled={pending}
              maxLength={120}
              {...describedBy("course-title", fields.title)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="course-category" label="Направление" error={fields.category}>
            <Input
              id="course-category"
              list="course-categories"
              value={values.category}
              onChange={(e) => set("category", e.target.value)}
              disabled={pending}
              {...describedBy("course-category", fields.category)}
            />
            <datalist id="course-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field id="course-tutor" label="Преподаватель" error={fields.tutorId}>
            <Select
              id="course-tutor"
              className="w-full"
              value={values.tutorId}
              onChange={(e) => set("tutorId", e.target.value)}
              disabled={pending}
              {...describedBy("course-tutor", fields.tutorId)}
            >
              {tutors.length === 0 && <option value="">Преподавателей пока нет</option>}
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="course-faculty" label="Факультет" error={fields.faculty}>
            <Select
              id="course-faculty"
              className="w-full"
              value={values.faculty}
              onChange={(e) => set("faculty", e.target.value)}
              disabled={pending}
              {...describedBy("course-faculty", fields.faculty)}
            >
              {FACULTIES.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="course-year" label="Учебный год" error={fields.academicYear} hint="Например, 2026/2027">
            <Input
              id="course-year"
              value={values.academicYear}
              onChange={(e) => set("academicYear", e.target.value)}
              disabled={pending}
              maxLength={9}
              inputMode="numeric"
              {...describedBy("course-year", fields.academicYear, true)}
            />
          </Field>
        </div>
        <Field
          id="course-description"
          label="Описание"
          error={fields.description}
          hint="Что студент узнает на курсе"
        >
          <Textarea
            id="course-description"
            rows={3}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            disabled={pending}
            maxLength={1000}
            {...describedBy("course-description", fields.description, true)}
          />
        </Field>
        {editing && (
          <Field id="course-status" label="Статус" error={fields.status} hint={statusHint[values.status]}>
            <Select
              id="course-status"
              className="w-full"
              value={values.status}
              onChange={(e) => set("status", e.target.value as CourseStatus)}
              disabled={pending}
              {...describedBy("course-status", fields.status, true)}
            >
              {COURSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {courseStatusMeta[s].label}
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
