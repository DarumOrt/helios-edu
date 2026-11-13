"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/shared/lib/api-client";
import { Button, Card, Field, Input, Select, DataState } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { type MailSettings } from "../mail";

export function SmtpSettings() {
  const { data, error, isLoading, mutate } = useSWR<MailSettings>("/api/mail/settings", fetcher);
  return (
    <DataState loading={isLoading} error={error}>
      {data && (
        <SmtpForm
          key={JSON.stringify(data)}
          initial={data}
          onSaved={async () => {
            await mutate();
          }}
        />
      )}
    </DataState>
  );
}

function SmtpForm({ initial, onSaved }: { initial: MailSettings; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState(initial);
  const [password, setPassword] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [result, setResult] = useState("");
  const { pending, error, run } = useFormSubmit();
  const set = <K extends keyof MailSettings>(key: K, value: MailSettings[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  async function check(email?: string) {
    const response = await run(() =>
      api.post<{ state: string; message: string }>("/api/mail/check", { email }),
    );
    if (response) {
      setResult(response.message);
      setValues((v) => ({ ...v, connectionState: response.state, checkedAt: new Date().toISOString() }));
    }
  }
  return (
    <div className="max-w-3xl space-y-5">
      <Card className="space-y-4 p-5">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const saved = await run(() =>
              api.put<MailSettings>("/api/mail/settings", { ...values, password: password || undefined }),
            );
            if (saved) {
              setPassword("");
              await onSaved();
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="smtp-host" label="SMTP Host">
              <Input
                id="smtp-host"
                value={values.host}
                required
                maxLength={253}
                onChange={(e) => set("host", e.target.value)}
              />
            </Field>
            <Field id="smtp-port" label="SMTP Port">
              <Input
                id="smtp-port"
                type="number"
                min={1}
                max={65535}
                value={values.port}
                onChange={(e) => set("port", Number(e.target.value))}
              />
            </Field>
            <Field id="smtp-security" label="Шифрование">
              <Select
                id="smtp-security"
                value={values.security}
                onChange={(e) => set("security", e.target.value)}
              >
                <option value="starttls">STARTTLS (обычно 587)</option>
                <option value="tls">SSL/TLS (обычно 465)</option>
                <option value="none">Без шифрования — только тестовый сервер</option>
              </Select>
            </Field>
            <Field id="smtp-username" label="Имя пользователя">
              <Input
                id="smtp-username"
                autoComplete="off"
                value={values.username}
                maxLength={254}
                onChange={(e) => set("username", e.target.value)}
              />
            </Field>
            <Field
              id="smtp-password"
              label="Пароль SMTP"
              hint={
                initial.hasPassword
                  ? "Пароль сохранён. Оставьте пустым, чтобы сохранить его."
                  : "Пароль не задан"
              }
            >
              <Input
                id="smtp-password"
                type="password"
                autoComplete="new-password"
                value={password}
                maxLength={1000}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field id="smtp-from" label="Email отправителя">
              <Input
                id="smtp-from"
                type="email"
                required
                value={values.fromEmail}
                onChange={(e) => set("fromEmail", e.target.value)}
              />
            </Field>
            <Field id="smtp-name" label="Имя отправителя">
              <Input
                id="smtp-name"
                value={values.fromName}
                maxLength={100}
                onChange={(e) => set("fromName", e.target.value)}
              />
            </Field>
          </div>
          <h2 className="font-semibold">Автоматические уведомления</h2>
          {(
            [
              ["userCreated", "Создание учётной записи"],
              ["invitation", "Приглашение нового пользователя"],
              ["courseAssigned", "Назначение курса"],
              ["groupAdded", "Добавление в группу"],
              ["coursePublished", "Публикация курса для группы"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex gap-2 text-sm">
              <input type="checkbox" checked={values[key]} onChange={(e) => set(key, e.target.checked)} />
              {label}
            </label>
          ))}
          <FormError message={error} />
          <Button type="submit" disabled={pending}>
            {pending ? "Сохраняем…" : "Сохранить настройки"}
          </Button>
        </form>
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Проверка сохранённых настроек</h2>
        <p className="text-sm text-muted-foreground">
          Состояние:{" "}
          {values.connectionState === "connected"
            ? "Подключение проверено"
            : values.connectionState === "error"
              ? "Ошибка подключения"
              : "Не проверено"}
          {values.checkedAt && ` · ${new Date(values.checkedAt).toLocaleString("ru")}`}
        </p>
        <Button variant="outline" disabled={pending} onClick={() => check()}>
          Проверить подключение
        </Button>
        <Field id="test-email" label="Адрес тестового письма">
          <Input
            id="test-email"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
        </Field>
        <Button variant="outline" disabled={pending || !testEmail} onClick={() => check(testEmail)}>
          Отправить тестовое письмо
        </Button>
        {result && (
          <p role="status" className="text-sm">
            {result}
          </p>
        )}
      </Card>
    </div>
  );
}
