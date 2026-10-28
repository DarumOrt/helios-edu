"use client";

import { useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Field, Input, describedBy } from "@/shared/ui";
import { api } from "@/shared/lib/api-client";
import { passwordChecks, PASSWORD_MIN } from "@/shared/lib/registration";
import { useSession } from "@/shared/auth/session";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import type { User } from "@/shared/types/domain";

/**
 * Смена своего пароля (POST /api/auth/password): текущий и новый по правилам регистрации.
 * Остальные сессии закрываются. В демо паролей нет — карточка поясняет это.
 */
export function ChangePassword() {
  const server = useSession((s) => s.dataSource.source === "server");
  const temporary = useSession((s) => Boolean(s.user.mustChangePassword));
  const { mutate } = useSWRConfig();
  const [values, setValues] = useState({ current: "", next: "", repeat: "" });
  const { pending, fields, error, run, setFields } = useFormSubmit();
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!values.current) errors.currentPassword = "Введите текущий пароль";
    if (passwordChecks(values.next).some((c) => !c.ok))
      errors.newPassword = `Пароль: не короче ${PASSWORD_MIN} символов, буквы и цифра`;
    else if (values.next !== values.repeat) errors.repeat = "Пароли не совпадают";
    if (Object.keys(errors).length) {
      setFields(errors);
      return;
    }
    const updated = await run(() =>
      api.post<User>("/api/auth/password", { currentPassword: values.current, newPassword: values.next }),
    );
    if (!updated) return;
    setValues({ current: "", next: "", repeat: "" });
    await mutate("/api/auth/me", updated, { revalidate: false });
    toast.success("Пароль изменён", { description: "На других устройствах нужно будет войти заново" });
  }

  return (
    <Card id="password">
      <CardHeader
        title="Пароль"
        subtitle={temporary ? "Вы вошли по временному паролю — замените его на свой" : undefined}
        icon={<KeyRound size={18} />}
      />
      <CardBody>
        {!server ? (
          <p className="text-sm text-muted-foreground">
            В демо вход без пароля — смена пароля в режиме «Сервер».
          </p>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-3">
            <Field id="pw-current" label="Текущий пароль" error={fields.currentPassword}>
              <Input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                value={values.current}
                onChange={(e) => set("current", e.target.value)}
                disabled={pending}
                {...describedBy("pw-current", fields.currentPassword)}
              />
            </Field>
            <Field
              id="pw-new"
              label="Новый пароль"
              error={fields.newPassword}
              hint={`Не короче ${PASSWORD_MIN} символов, буквы и цифра`}
            >
              <Input
                id="pw-new"
                type="password"
                autoComplete="new-password"
                value={values.next}
                onChange={(e) => set("next", e.target.value)}
                disabled={pending}
                {...describedBy("pw-new", fields.newPassword, true)}
              />
            </Field>
            <Field id="pw-repeat" label="Повторите новый пароль" error={fields.repeat}>
              <Input
                id="pw-repeat"
                type="password"
                autoComplete="new-password"
                value={values.repeat}
                onChange={(e) => set("repeat", e.target.value)}
                disabled={pending}
                {...describedBy("pw-repeat", fields.repeat)}
              />
            </Field>
            <FormError message={error} />
            <Button type="submit" disabled={pending}>
              {pending ? "Сохраняем…" : "Сменить пароль"}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
