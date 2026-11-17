import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { FormulaWaves } from "./FormulaWaves";

export function WavePanel({
  children,
  className,
  animated = true,
}: {
  children: ReactNode;
  className?: string;
  animated?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border bg-card text-waves-ink shadow-elevate",
        className,
      )}
    >
      <FormulaWaves className="-z-20" animated={animated} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-card via-card/65 via-50% to-transparent to-90%"
      />
      {children}
    </section>
  );
}
