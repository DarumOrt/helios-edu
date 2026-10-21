import Link from "next/link";
import { cn } from "@/shared/lib/utils";

export interface Fact {
  label: string;
  value: string | number;
  /** подсветить, если число требует внимания */
  tone?: "default" | "warning" | "danger";
  href?: string;
}

const toneClass: Record<NonNullable<Fact["tone"]>, string> = {
  default: "text-foreground",
  warning: "text-warning",
  danger: "text-danger",
};

// Сводка одной полосой вместо плиток с иконками: цифры читаются в строку, внимание — цветом числа.
export function FactStrip({ facts }: { facts: Fact[] }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl bg-card shadow-card sm:grid-cols-4">
      {facts.map((f, i) => {
        const body = (
          <>
            <div className="text-xs text-muted-foreground">{f.label}</div>
            <div
              className={cn(
                "mt-1 font-mono text-2xl leading-none font-semibold tabular-nums",
                toneClass[f.tone ?? "default"],
              )}
            >
              {f.value}
            </div>
          </>
        );
        const cell = cn(
          "block px-5 py-4",
          i > 0 && "sm:border-l",
          i % 2 === 1 && "border-l sm:border-l",
          i > 1 && "border-t sm:border-t-0",
        );
        return f.href ? (
          <Link key={f.label} href={f.href} className={cn(cell, "transition-colors hover:bg-muted/60")}>
            {body}
          </Link>
        ) : (
          <div key={f.label} className={cell}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
