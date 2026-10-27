"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useDayPart } from "@/shared/lib/use-day-part";
import { SkyScene, sky } from "@/shared/ui/SkyScene";

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
  const part = day?.part ?? "day";
  const night = part === "night";
  const heading = title ?? `${day ? day.greeting : "Здравствуйте"}${name ? `, ${name}` : ""}`;

  return (
    <section
      className={cn("relative overflow-hidden rounded-2xl border", night ? "text-white" : "text-sky-ink")}
      style={{ background: sky[part] }}
    >
      <SkyScene part={part} progress={day?.sunProgress ?? 0.5} />
      <div className="relative max-w-xl px-7 pt-7 pb-9 md:px-9">
        <div className={cn("font-mono text-xs", night ? "text-white/75" : "text-sky-ink/70")}>
          {day?.dateLabel ?? " "}
        </div>
        <h1 className="mt-2 animate-enter text-3xl font-bold tracking-tight text-balance md:text-4xl">
          {heading}
        </h1>
        {subtitle && (
          <p className={cn("mt-2 max-w-lg text-base", night ? "text-white/85" : "text-sky-ink/75")}>
            {subtitle}
          </p>
        )}
        {chips && <div className="mt-4 flex flex-wrap gap-2">{chips}</div>}
        {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}
