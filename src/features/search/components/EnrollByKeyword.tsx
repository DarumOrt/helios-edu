"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { KeyRound } from "lucide-react";
import { api } from "@/shared/lib/api-client";
import { Button, Card, CardBody, Field, Input, describedBy } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";

export function EnrollByKeyword({ courseId }: { courseId: string }) {
  const [keyword, setKeyword] = useState("");
  const { pending, fields, error, run } = useFormSubmit();
  const router = useRouter();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!(await run(() => api.post(`/api/courses/${courseId}/enroll`, { keyword: keyword.trim() })))) return;
    await mutate(
      (key) => typeof key === "string" && (key.startsWith("/api/courses") || key === "/api/catalog"),
    );
    router.push(`/courses/${courseId}`);
  }
  return (
    <Card>
      <CardBody>
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound size={18} className="text-primary" aria-hidden />
          Записаться на курс
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Введите кодовое слово, которое сообщил преподаватель. Курс появится в «Моих курсах».
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Field
            id="join-keyword"
            label="Кодовое слово"
            error={fields.keyword}
            hint="Учитывается регистр букв."
          >
            <Input
              id="join-keyword"
              type="password"
              autoComplete="off"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              maxLength={64}
              disabled={pending}
              required
              {...describedBy("join-keyword", fields.keyword, true)}
            />
          </Field>
          <FormError message={error} />
          <Button type="submit" disabled={pending || !keyword.trim()}>
            {pending ? "Записываем…" : "Вступить на курс"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
