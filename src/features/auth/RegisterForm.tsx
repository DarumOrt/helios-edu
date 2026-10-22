"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Circle } from "lucide-react";
import { api, apiErrorInfo } from "@/shared/lib/api-client";
import { Button } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import {
  passwordChecks,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationInput,
} from "@/shared/lib/registration";
import type { DataSource } from "@/shared/lib/data-source";
import type { User } from "@/shared/types/domain";
import { AuthInput, Field, PasswordInput, describedBy } from "./Field";

const fieldOrder: (keyof RegistrationInput)[] = ["name", "email", "password", "consent"];

// Регистрация студента. Сервер: аккаунт и сессия в C# API. Демо: пользователь в памяти, вход через Zustand.
export function RegisterForm({ source }: { source: DataSource }) {
  const setUser = useSessionStore((s) => s.setUser);
  const [values, setValues] = useState<RegistrationInput>({
    name: "",
    email: "",
    password: "",
    consent: false,
  });
  const [touched, setTouched] = useState<Partial<Record<keyof RegistrationInput, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  // Куда вернуть фокус после проверки: новый объект на каждую попытку, поля к этому моменту уже доступны.
  const [focusTarget, setFocusTarget] = useState<{ key: keyof RegistrationInput } | null>(null);

  useEffect(() => {
    if (focusTarget) document.getElementById(`reg-${focusTarget.key}`)?.focus();
  }, [focusTarget]);

  // Ошибку показываем после того, как человек ушёл с поля или нажал «Создать», — не во время набора.
  const clientErrors = validateRegistration(values);
  const errorOf = (key: keyof RegistrationInput) =>
    serverErrors[key] ?? (touched[key] ? clientErrors[key] : undefined);

  function update<K extends keyof RegistrationInput>(key: K, value: RegistrationInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setServerErrors((e) => ({ ...e, [key]: undefined }));
  }
  const touch = (key: keyof RegistrationInput) => setTouched((t) => ({ ...t, [key]: true }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ name: true, email: true, password: true, consent: true });
    setFormError("");
    const firstInvalid = fieldOrder.find((key) => clientErrors[key]);
    if (firstInvalid) {
      setFocusTarget({ key: firstInvalid });
      return;
    }

    setPending(true);
    try {
      const user = await api.post<User>("/api/auth/register", values);
      if (source === "demo") setUser(user);
      // Полная навигация: в серверном режиме кабинет прочитает новую сессию из cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Нужен новый документ, чтобы кабинет загрузился уже с новой сессией.
      window.location.assign("/dashboard");
    } catch (failure) {
      setPending(false);
      const { status, error, fields } = apiErrorInfo(failure);
      if (fields && Object.keys(fields).length) {
        setServerErrors(fields);
        const first = fieldOrder.find((key) => fields[key]);
        if (first) setFocusTarget({ key: first });
        return;
      }
      setFormError(
        status === 429
          ? "Слишком много попыток. Подождите минуту и попробуйте снова."
          : (error ?? "Не удалось создать учётную запись. Проверьте соединение и попробуйте ещё раз."),
      );
    }
  }

  const passwordError = errorOf("password");

  return (
    <section aria-labelledby="register-title">
      <h1 id="register-title" className="text-2xl leading-tight font-semibold text-balance">
        Регистрация студента
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Группу и курсы назначит организатор — после этого они появятся в кабинете.
        {source === "demo" && " В демо-режиме учётная запись живёт до перезапуска сервера."}
      </p>

      <form onSubmit={submit} noValidate className="mt-7 space-y-5">
        <Field id="reg-name" label="Имя и фамилия" error={errorOf("name")}>
          <AuthInput
            id="reg-name"
            name="name"
            autoComplete="name"
            placeholder="Иван Вагулин"
            maxLength={100}
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            onBlur={() => touch("name")}
            disabled={pending}
            {...describedBy("reg-name", errorOf("name"))}
          />
        </Field>

        <Field
          id="reg-email"
          label="Электронная почта"
          error={errorOf("email")}
          hint="На неё придут уведомления о сроках и оценках"
        >
          <AuthInput
            id="reg-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@pstu.ru"
            maxLength={254}
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            onBlur={() => touch("email")}
            disabled={pending}
            {...describedBy("reg-email", errorOf("email"), true)}
          />
        </Field>

        <Field
          id="reg-password"
          label="Пароль"
          error={passwordError}
          hint={
            <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Требования к паролю">
              {passwordChecks(values.password).map((check) => (
                <li
                  key={check.label}
                  className={cn(
                    "flex items-center gap-1.5 transition-colors",
                    check.ok ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {check.ok ? <Check size={13} aria-hidden /> : <Circle size={10} aria-hidden />}
                  {check.label}
                  <span className="sr-only">{check.ok ? " — выполнено" : " — не выполнено"}</span>
                </li>
              ))}
            </ul>
          }
        >
          <PasswordInput
            id="reg-password"
            name="password"
            autoComplete="new-password"
            maxLength={256}
            value={values.password}
            onChange={(e) => update("password", e.target.value)}
            onBlur={() => touch("password")}
            disabled={pending}
            {...describedBy("reg-password", passwordError, true)}
          />
        </Field>

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              id="reg-consent"
              type="checkbox"
              checked={values.consent}
              onChange={(e) => {
                update("consent", e.target.checked);
                touch("consent");
              }}
              disabled={pending}
              className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-sm accent-primary"
              {...describedBy("reg-consent", errorOf("consent"))}
            />
            <span className="text-muted-foreground">
              Согласен на обработку персональных данных (152-ФЗ) для учёбы в электронной среде ПНИПУ
            </span>
          </label>
          {errorOf("consent") && (
            <p id="reg-consent-error" className="mt-1.5 pl-8 text-xs text-danger">
              {errorOf("consent")}
            </p>
          )}
        </div>

        {formError && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending}>
          {pending ? "Создаём учётную запись…" : "Создать учётную запись"}
          {!pending && <ArrowRight size={17} aria-hidden />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Уже есть учётная запись?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Войдите
        </Link>
      </p>
    </section>
  );
}
