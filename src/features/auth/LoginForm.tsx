"use client";

import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { api, ApiError } from "@/shared/lib/api-client";
import { BrandMark, Button, Card, Input } from "@/shared/ui";

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

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
          ? "Неверная почта или пароль."
          : status === 429
            ? "Слишком много попыток. Попробуйте через минуту."
            : "Не удалось войти. Проверьте соединение и попробуйте ещё раз.",
      );
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md p-8 sm:p-10" role="region" aria-labelledby="login-title">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <BrandMark size={30} />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">HeliosEDU</p>
            <p className="font-mono text-xs text-muted-foreground">ПНИПУ · ИНЭК</p>
          </div>
        </div>
        <h1 id="login-title" className="text-2xl leading-tight font-semibold">
          Вход в личный кабинет
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Введите почту и пароль вашей учётной записи.</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="email">
              Электронная почта
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="name@example.ru"
              required
              maxLength={254}
              disabled={pending}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="password">
              Пароль
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              disabled={pending}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            <LogIn size={17} />
            {pending ? "Входим…" : "Войти"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
