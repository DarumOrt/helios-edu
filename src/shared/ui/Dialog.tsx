"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

// Модальное окно на нативном <dialog>: фокус внутри окна, Esc и клик по фону закрывают.
// По брендкоду: радиус 16px, появление scale(0.97) → 1 за 160ms, без движения при reduced motion.
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // фокус — в первое поле формы, а не на кнопку «Закрыть»
      dialog.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-card p-0 text-card-foreground shadow-elevate backdrop:bg-foreground/40 open:motion-safe:animate-pop-in",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
            <div>
              <h2 id={titleId} className="text-lg leading-tight font-semibold text-balance">
                {title}
              </h2>
              {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t px-6 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
