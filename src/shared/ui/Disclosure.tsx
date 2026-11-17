import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function Disclosure({
  title,
  icon,
  meta,
  defaultOpen,
  children,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn("group/disclosure min-w-0 rounded-xl border bg-card shadow-card", className)}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset sm:px-4 [&::-webkit-details-marker]:hidden">
        {icon && (
          <span
            className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft text-primary"
            aria-hidden
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1 text-sm leading-snug font-semibold wrap-break-word">{title}</span>
        {meta != null && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{meta}</span>}
        <ChevronDown
          size={16}
          className="shrink-0 text-muted-foreground group-open/disclosure:rotate-180 motion-safe:transition-transform motion-safe:duration-150"
          aria-hidden
        />
      </summary>
      <div className="mx-3 border-t pt-1 pb-2 sm:mx-4">{children}</div>
    </details>
  );
}
