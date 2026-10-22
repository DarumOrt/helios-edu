"use client";

import { useState } from "react";
import { apiErrorInfo } from "@/shared/lib/api-client";

// Отправка формы (управление, конструктор курса): ошибки полей — у полей, остальное — одной строкой над кнопками.
export function useFormSubmit() {
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    setPending(true);
    setFields({});
    setError("");
    try {
      return await action();
    } catch (failure) {
      const info = apiErrorInfo(failure);
      if (info.fields) setFields(info.fields);
      setError(
        info.status === 501
          ? "На сервере эта функция ещё не подключена. Переключитесь на «Демо» или дождитесь обновления бэкенда."
          : info.status === 403
            ? (info.error ?? "Недостаточно прав для этого действия")
            : info.fields
              ? ""
              : (info.error ?? "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз."),
      );
      return undefined;
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setFields({});
    setError("");
  }

  return { pending, fields, error, run, reset, setFields };
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger">
      {message}
    </p>
  );
}
