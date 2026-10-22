"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button, Dialog, Field, Input, Select, describedBy } from "@/shared/ui";
import { assignableRoles, isSelf } from "@/shared/auth/management";
import { validateUser } from "@/shared/lib/management-validation";
import type { Cohort, Role, User } from "@/shared/types/domain";
import { adminApi, refreshManagement, type UserPayload } from "../api";
import { roleLabel } from "../labels";
import { FormError, useFormSubmit } from "../use-form-submit";

// Создание и правка пользователя. Правила ролей — shared/auth/management (их же применяет сервер).
export function UserDialog({
  open,
  onClose,
  user,
  actor,
  cohorts,
}: {
  open: boolean;
  onClose: () => void;
  /** нет — создаём нового */
  user?: User;
  actor: User;
  cohorts: Cohort[];
}) {
  const editing = Boolean(user);
  const self = user ? isSelf(actor, user) : false;
  const [values, setValues] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: (user?.role ?? "student") as Role,
    group: user?.group ?? "",
    faculty: user?.faculty ?? "ИНЭК",
    blocked: user?.status === "blocked",
  });
  const [password, setPassword] = useState<string | null>(null);
  const { pending, fields, error, run, setFields } = useFormSubmit();

  // своя роль не меняется; иначе — только назначаемые актором
  const roles = self ? [values.role] : assignableRoles(actor.role);
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload: UserPayload = {
      name: values.name,
      email: values.email,
      role: values.role,
      group: values.role === "student" ? values.group || null : null,
      faculty: values.faculty || null,
      ...(editing && !self && { status: values.blocked ? "blocked" : "active" }),
    };
    const clientErrors = validateUser(payload as Parameters<typeof validateUser>[0]);
    if (Object.keys(clientErrors).length) {
      setFields(clientErrors);
      return;
    }
    if (user) {
      const updated = await run(() => adminApi.updateUser(user.id, payload));
      if (!updated) return;
      toast.success("Изменения сохранены", { description: updated.name });
      await refreshManagement();
      onClose();
      return;
    }
    const created = await run(() => adminApi.createUser(payload));
    if (!created) return;
    await refreshManagement();
    // сервер выдаёт временный пароль один раз — показываем его, пока окно открыто
    if (created.temporaryPassword) setPassword(created.temporaryPassword);
    else {
      toast.success("Пользователь добавлен", { description: created.user.name });
      onClose();
    }
  }

  if (password)
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Пользователь добавлен"
        description="Передайте временный пароль лично. Он показывается один раз — после закрытия окна посмотреть его будет нельзя."
        footer={<Button onClick={onClose}>Готово</Button>}
      >
        <TemporaryPassword value={password} />
      </Dialog>
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Изменить пользователя" : "Добавить пользователя"}
      description={editing ? user!.email : "Учётная запись появится сразу. Войти можно будет по почте."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" form="user-form" disabled={pending}>
            {pending ? "Сохраняем…" : editing ? "Сохранить" : "Добавить"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate className="space-y-4">
        <Field id="user-name" label="Имя и фамилия" error={fields.name}>
          <Input
            id="user-name"
            autoComplete="off"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={pending}
            {...describedBy("user-name", fields.name)}
          />
        </Field>
        <Field id="user-email" label="Электронная почта" error={fields.email}>
          <Input
            id="user-email"
            type="email"
            autoComplete="off"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            disabled={pending}
            {...describedBy("user-email", fields.email)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="user-role"
            label="Роль"
            error={fields.role}
            hint={self ? "Свою роль изменить нельзя" : undefined}
          >
            <Select
              id="user-role"
              className="w-full"
              value={values.role}
              onChange={(e) => set("role", e.target.value as Role)}
              disabled={pending || self}
              {...describedBy("user-role", fields.role, self)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="user-faculty" label="Факультет" error={fields.faculty}>
            <Input
              id="user-faculty"
              value={values.faculty}
              onChange={(e) => set("faculty", e.target.value)}
              disabled={pending}
              {...describedBy("user-faculty", fields.faculty)}
            />
          </Field>
        </div>
        {values.role === "student" && (
          <Field id="user-group" label="Группа" error={fields.group} hint="Студент видит курсы своей группы">
            <Select
              id="user-group"
              className="w-full"
              value={values.group}
              onChange={(e) => set("group", e.target.value)}
              disabled={pending}
              {...describedBy("user-group", fields.group, true)}
            >
              <option value="">Без группы</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {editing && !self && (
          <label className="flex cursor-pointer items-start gap-3 rounded-md bg-muted/60 px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={values.blocked}
              onChange={(e) => set("blocked", e.target.checked)}
              disabled={pending}
              className="mt-0.5 size-4 shrink-0 accent-danger"
            />
            <span>
              <span className="font-medium">Заблокировать вход</span>
              <span className="block text-muted-foreground">
                Учётная запись и оценки сохранятся, но войти будет нельзя
              </span>
            </span>
          </label>
        )}
        <FormError message={error} />
      </form>
    </Dialog>
  );
}

function TemporaryPassword({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать — выделите пароль вручную");
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
      <code className="flex-1 font-mono text-base tracking-wide select-all">{value}</code>
      <Button variant="ghost" size="sm" onClick={copy} aria-live="polite">
        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        {copied ? "Скопировано" : "Скопировать"}
      </Button>
    </div>
  );
}
