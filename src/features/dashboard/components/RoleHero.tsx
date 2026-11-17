"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useDayPart } from "@/shared/lib/use-day-part";
import { FormulaWaves } from "@/shared/ui/FormulaWaves";

export function HeroChip({
  icon: Icon,
  children,
  tone = "default",
}: {
  icon?: LucideIcon;
  children: ReactNode;
  tone?: "default" | "sun";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
        tone === "sun" ? "bg-sun text-sky-ink" : "bg-card/85 text-foreground ring-1 ring-black/5",
      )}
    >
      {Icon && <Icon size={15} aria-hidden />}
      {children}
    </span>
  );
}

export function RoleHero({
  name,
  title,
  subtitle,
  chips,
  actions,
}: {
  /** имя для приветствия; если задан title — используется он */
  name?: string;
  title?: string;
  subtitle?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
}) {
  const day = useDayPart();
  const heading = title ?? `${day ? day.greeting : "Здравствуйте"}${name ? `, ${name}` : ""}`;

  return (
    <section className="relative isolate overflow-hidden rounded-2xl border text-waves-ink">
      <FormulaWaves className="-z-10" />
      <div className="relative max-w-xl px-7 pt-7 pb-9 md:px-9">
        <div className="font-mono text-xs text-waves-ink/70">{day?.dateLabel ?? " "}</div>
        <h1 className="mt-2 animate-enter text-3xl font-bold tracking-tight text-balance md:text-4xl">
          {heading}
        </h1>
        {subtitle && <p className="mt-2 max-w-lg text-base text-waves-ink/80">{subtitle}</p>}
        {chips && <div className="mt-4 flex flex-wrap gap-2">{chips}</div>}
        {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}
