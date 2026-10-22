"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { api, ApiError } from "@/shared/lib/api-client";
import { Button } from "@/shared/ui";
import { AuthInput, Field, PasswordInput, describedBy } from "./Field";

// Вход по почте и паролю — серверный режим (C# API, сессия в httpOnly-cookie).
export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  // Номер неудачной попытки: после неё фокус возвращается в пароль, когда поля снова доступны.
  const [failedAttempt, setFailedAttempt] = useState(0);

  useEffect(() => {
    if (!failedAttempt) return;
    passwordRef.current?.focus();
    passwordRef.current?.select();
  }, [failedAttempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await api.post("/api/auth/login", { email: form.get("email"), password: form.get("password") });
      // Полная навигация очищает клиентские кэши предыдущего пользователя.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Нужен новый документ, чтобы сбросить SWR и состояние прошлого пользователя.
      window.location.assign("/dashboard");
    } catch (failure) {
      const status = failure instanceof ApiError ? failure.status : 0;
      setError(
        status === 401
          ? "Неверная почта или пароль. Проверьте раскладку и Caps Lock."
          : status === 429
            ? "Слишком много попыток. Подождите минуту и попробуйте снова."
            : "Не удалось войти. Проверьте соединение и попробуйте ещё раз.",
      );
      setPending(false);
      setFailedAttempt((n) => n + 1);
    }
  }

  return (
    <section aria-labelledby="login-title">
      <h1 id="login-title" className="text-2xl leading-tight font-semibold text-balance">
        Вход в личный кабинет
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Введите почту и пароль вашей учётной записи.</p>

      <form onSubmit={submit} className="mt-7 space-y-5">
        <Field id="email" label="Электронная почта">
          <AuthInput
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="name@pstu.ru"
            required
            maxLength={254}
            disabled={pending}
            {...describedBy("email", error)}
          />
        </Field>
        <Field id="password" label="Пароль">
          <PasswordInput
            ref={passwordRef}
            id="password"
            name="password"
            autoComplete="current-password"
            required
            maxLength={256}
            disabled={pending}
            {...describedBy("password", error)}
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending}>
          {pending ? "Входим…" : "Войти"}
          {!pending && <ArrowRight size={17} aria-hidden />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Впервые здесь?{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Создайте учётную запись
        </Link>
      </p>
    </section>
  );
}
