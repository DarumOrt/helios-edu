"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { api, apiErrorInfo } from "@/shared/lib/api-client";
import { Button } from "@/shared/ui";
import {
  validateRegistration,
  type RegistrationErrors,
  type RegistrationInput,
} from "@/shared/lib/registration";
import type { DataSource } from "@/shared/lib/data-source";
import { AuthInput, Field, describedBy } from "./Field";

const fieldOrder: (keyof RegistrationInput)[] = ["name", "email", "consent"];

export function RegisterForm({ source }: { source: DataSource }) {
  const [values, setValues] = useState<RegistrationInput>({
    name: "",
    email: "",
    consent: false,
  });
  const [touched, setTouched] = useState<Partial<Record<keyof RegistrationInput, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  // Куда вернуть фокус после проверки: новый объект на каждую попытку, поля к этому моменту уже доступны.
  const [focusTarget, setFocusTarget] = useState<{ key: keyof RegistrationInput } | null>(null);

  useEffect(() => {
    if (focusTarget) document.getElementById(`reg-${focusTarget.key}`)?.focus();
  }, [focusTarget]);

  // Ошибку показываем после того, как человек ушёл с поля или нажал «Отправить заявку», — не во время набора.
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
    setTouched({ name: true, email: true, consent: true });
    setFormError("");
    const firstInvalid = fieldOrder.find((key) => clientErrors[key]);
    if (firstInvalid) {
      setFocusTarget({ key: firstInvalid });
      return;
    }

    setPending(true);
    try {
      await api.post("/api/auth/register", values);
      setSent(true);
    } catch (failure) {
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
          : (error ?? "Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз."),
      );
    } finally {
      setPending(false);
    }
  }

  if (sent)
    return (
      <section aria-labelledby="register-title" role="status">
        <h1 id="register-title" className="text-2xl font-semibold">
          Заявка отправлена
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {source === "server"
            ? "После одобрения на указанную почту придёт ссылка для установки пароля."
            : "Заявку можно обработать в разделе «Пользователи» в демо-кабинете."}
        </p>
        <Link href="/login" className="mt-5 inline-block font-medium text-primary hover:underline">
          Вернуться ко входу
        </Link>
      </section>
    );

  return (
    <section aria-labelledby="register-title">
      <h1 id="register-title" className="text-2xl leading-tight font-semibold text-balance">
        Заявка на доступ
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Доступ откроется после назначения роли.
        {source === "demo" && " Данные демо сбрасываются при перезапуске сервера."}
      </p>

      <form onSubmit={submit} noValidate className="mt-7 space-y-5">
        <Field id="reg-name" label="Имя и фамилия" error={errorOf("name")}>
          <AuthInput
            id="reg-name"
            name="name"
            autoComplete="name"
            placeholder="Имя Фамилия"
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
          hint="На неё придёт приглашение после одобрения заявки"
        >
          <AuthInput
            id="reg-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@pspu.ru"
            maxLength={254}
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            onBlur={() => touch("email")}
            disabled={pending}
            {...describedBy("reg-email", errorOf("email"), true)}
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
              Согласен на обработку персональных данных (152-ФЗ) для учёбы в электронной среде ПГГПУ
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
          {pending ? "Отправляем…" : "Отправить заявку"}
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
