"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, describedBy } from "@/shared/ui";
import { validateCohort } from "@/shared/lib/management-validation";
import type { Cohort } from "@/shared/types/domain";
import { adminApi, refreshManagement } from "../api";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";

// Создание и переименование группы. Студенты при переименовании остаются в группе.
export function CohortDialog({
  open,
  onClose,
  cohort,
}: {
  open: boolean;
  onClose: () => void;
  cohort?: Cohort;
}) {
  const router = useRouter();
  const [name, setName] = useState(cohort?.name ?? "");
  const [faculty, setFaculty] = useState(cohort?.faculty ?? "ИНЭК");
  const { pending, fields, error, run, setFields } = useFormSubmit();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clientErrors = validateCohort({ name, faculty });
    if (Object.keys(clientErrors).length) {
      setFields(clientErrors);
      return;
    }
    const saved = await run(() =>
      cohort
        ? adminApi.updateCohort(cohort.id, { name, faculty: faculty || null })
        : adminApi.createCohort({ name, faculty: faculty || undefined }),
    );
    if (!saved) return;
    await refreshManagement();
    onClose();
    if (cohort) toast.success("Группа переименована", { description: saved.name });
    else {
      toast.success("Группа создана", { description: "Добавьте студентов и курсы" });
      router.push(`/admin/cohorts/${saved.id}`);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={cohort ? "Переименовать группу" : "Создать группу"}
      description={
        cohort ? "Студенты останутся в группе." : "Студентов и курсы можно добавить сразу после создания."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" form="cohort-form" disabled={pending}>
            {pending ? "Сохраняем…" : cohort ? "Сохранить" : "Создать"}
          </Button>
        </>
      }
    >
      <form id="cohort-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field id="cohort-name" label="Название" error={fields.name} hint="Например, М1227 или 1237">
          <Input
            id="cohort-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            maxLength={30}
            {...describedBy("cohort-name", fields.name, true)}
          />
        </Field>
        <Field id="cohort-faculty" label="Факультет" error={fields.faculty}>
          <Input
            id="cohort-faculty"
            value={faculty}
            onChange={(e) => setFaculty(e.target.value)}
            disabled={pending}
            {...describedBy("cohort-faculty", fields.faculty)}
          />
        </Field>
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Dialog>
  );
}
