"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Input } from "@/shared/ui";
import { api } from "@/shared/lib/api-client";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";

export default function ActivatePage() {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const { pending, error, run } = useFormSubmit();
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Card className="space-y-5 p-6">
        <h1 className="text-xl font-semibold">Активация учётной записи</h1>
        {done ? (
          <p>
            Пароль установлен.{" "}
            <Link href="/login" className="text-primary underline">
              Войти в HeliosEDU
            </Link>
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
              const result = await run(() => api.post("/api/auth/activate", { token, password }));
              if (result) {
                window.history.replaceState(null, "", "/activate");
                setPassword("");
                setDone(true);
              }
            }}
          >
            <p className="text-sm text-muted-foreground">
              Ссылка действует 48 часов и используется один раз. Придумайте пароль от 8 символов с буквами и
              цифрами.
            </p>
            <Field id="activation-password" label="Новый пароль">
              <Input
                id="activation-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={256}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <FormError message={error} />
            <Button type="submit" disabled={pending}>
              {pending ? "Сохраняем…" : "Установить пароль"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
