"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { AdaptiveQuestion } from "@/shared/types/domain";

// Поле ответа на вопрос теста. После проверки (correct задан) подсвечивается правильный вариант.
export function AnswerInput({
  question: q,
  value,
  disabled,
  onChange,
  correct,
}: {
  question: AdaptiveQuestion;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
  correct?: number | string | boolean;
}) {
  const checked = correct !== undefined;

  if (q.type === "mcq")
    return (
      <div className="grid gap-2" role="radiogroup" aria-label="Варианты ответа">
        {q.options.map((opt, i) => {
          const selected = value === i;
          const right = checked && correct === i;
          return (
            <label
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-md border px-4 py-3 transition",
                disabled ? "cursor-default" : "cursor-pointer hover:bg-muted/40",
                right
                  ? "border-success bg-success-soft"
                  : selected
                    ? checked
                      ? "border-danger bg-danger-soft"
                      : "border-primary bg-primary-soft"
                    : "border-border",
              )}
            >
              <input
                type="radio"
                name={q.id}
                className="sr-only"
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(i)}
              />
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-primary" : "border-muted-foreground/40",
                )}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              <span className="text-sm">{opt}</span>
            </label>
          );
        })}
      </div>
    );

  if (q.type === "boolean")
    return (
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: true, l: "Верно" },
          { v: false, l: "Неверно" },
        ].map((o) => {
          const selected = value === o.v;
          const right = checked && correct === o.v;
          return (
            <button
              key={String(o.v)}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(o.v)}
              className={cn(
                "rounded-md border px-4 py-3 text-sm font-medium transition disabled:cursor-default",
                right
                  ? "border-success bg-success-soft text-success"
                  : selected
                    ? checked
                      ? "border-danger bg-danger-soft text-danger"
                      : "border-primary bg-primary-soft text-primary"
                    : "border-border hover:bg-muted/40",
              )}
            >
              {selected && <CheckCircle2 size={14} className="mr-2 inline" aria-hidden />}
              {o.l}
            </button>
          );
        })}
      </div>
    );

  return (
    <div>
      <input
        type="text"
        aria-label="Ваш ответ"
        className="w-full rounded-md border bg-card px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-hidden disabled:opacity-70"
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ваш ответ"
      />
      {checked && typeof correct === "string" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Правильный ответ: <span className="font-medium text-foreground">{correct}</span>
        </p>
      )}
    </div>
  );
}
