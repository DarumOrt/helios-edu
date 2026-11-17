"use client";

import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import { useDayPart } from "@/shared/lib/use-day-part";
import { WavePanel } from "@/shared/ui";

export function RoleHero({
  name,
  title,
  subtitle,
  actions,
  aside,
}: {
  name?: string;
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  const day = useDayPart();
  const heading = title ?? `${day ? day.greeting : "Здравствуйте"}${name ? `, ${name}` : ""}`;

  return (
    <WavePanel className="grid min-h-48 items-center gap-4 p-4 sm:p-7 xl:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="min-w-0">
        <div className="flex min-h-5 items-center gap-1.5 text-xs font-medium">
          <CalendarDays size={14} aria-hidden />
          {day?.dateLabel}
        </div>
        <h1 className="mt-2 text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
          {heading}
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed">{subtitle}</p>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {aside}
    </WavePanel>
  );
}
