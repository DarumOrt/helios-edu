import type { ReactNode } from "react";

// Поле формы: подпись, подсказка и ошибка связаны с полем для экранных читалок.
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
