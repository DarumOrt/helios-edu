"use client";

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";

// Поле формы входа/регистрации: подпись, подсказка и ошибка связаны с полем для экранных читалок.
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <div id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
            {hint}
          </div>
        )
      )}
    </div>
  );
}

// aria-атрибуты поля по наличию ошибки и подсказки
export function describedBy(id: string, error?: string, hasHint?: boolean) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}

export const AuthInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <Input
      ref={ref}
      className={cn(
        "h-11 text-base aria-invalid:border-danger aria-invalid:ring-danger/30 sm:text-sm",
        className,
      )}
      {...rest}
    />
  ),
);
AuthInput.displayName = "AuthInput";

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, id, ...rest }, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <AuthInput
        ref={ref}
        id={id}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
      >
        {visible ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

// Разбор ответа API: общая ошибка и ошибки по полям (формат { error, fields })
export function parseApiError(details: unknown): { error?: string; fields?: Record<string, string> } {
  if (typeof details !== "string" || !details) return {};
  try {
    const data = JSON.parse(details) as { error?: unknown; fields?: unknown };
    return {
      error: typeof data.error === "string" ? data.error : undefined,
      fields:
        data.fields && typeof data.fields === "object" ? (data.fields as Record<string, string>) : undefined,
    };
  } catch {
    return {};
  }
}
