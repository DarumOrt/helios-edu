"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useDayPart, type DayPart } from "@/shared/lib/use-day-part";

// Приветствие кабинета. Небо и положение солнца показывают реальное время суток —
// это единственное место в продукте, где разрешён градиент: он несёт смысл, а не украшает.

const sky: Record<DayPart, string> = {
  morning: "linear-gradient(160deg, #FFE7CC 0%, #FDF1E0 45%, #DDEBF6 100%)",
  day: "linear-gradient(170deg, #CFE3F6 0%, #E4F0FA 55%, #F3F7F5 100%)",
  evening: "linear-gradient(165deg, #F8C9A2 0%, #F1D5D8 45%, #CFD7EE 100%)",
  night: "linear-gradient(170deg, #14213D 0%, #1D3360 60%, #27427A 100%)",
};

// Позиции звёзд фиксированы, чтобы рендер был чистым
const stars = [
  [480, 40],
  [530, 110],
  [560, 30],
  [690, 120],
  [640, 150],
  [720, 50],
  [460, 140],
  [600, 125],
];

function Scene({ part, progress }: { part: DayPart; progress: number }) {
  const night = part === "night";
  const x = 440 + progress * 300;
  const y = 196 - Math.sin(progress * Math.PI) * 130;
  return (
    <svg
      viewBox="0 0 760 220"
      preserveAspectRatio="xMaxYMax slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* дуга дневного пути солнца — чертёжной пунктирной линией */}
      <path
        d="M440 196 Q590 -64 740 196"
        fill="none"
        stroke={night ? "rgba(255,255,255,.18)" : "rgba(29,79,145,.18)"}
        strokeWidth="1.5"
        strokeDasharray="4 6"
      />
      {night ? (
        <g className="animate-rise">
          {stars.map(([sx, sy]) => (
            <circle key={`${sx}-${sy}`} cx={sx} cy={sy} r="1.6" fill="#FFF6DA" opacity=".8" />
          ))}
          <circle cx="640" cy="72" r="22" fill="#FFF1C9" />
          <circle cx="651" cy="64" r="20" fill="#1D3360" />
        </g>
      ) : (
        <g className="animate-rise">
          <circle
            cx={x}
            cy={y}
            r="58"
            fill="#F5A524"
            className="origin-center animate-glow"
            style={{ transformBox: "fill-box" }}
          />
          <circle cx={x} cy={y} r="30" fill="#F5A524" />
        </g>
      )}
      {/* горизонт-линейка: тот же мотив, что в знаке HeliosEDU */}
      <line
        x1="0"
        y1="196"
        x2="760"
        y2="196"
        stroke={night ? "rgba(255,255,255,.35)" : "rgba(22,27,31,.25)"}
      />
      {Array.from({ length: 38 }, (_, i) => (
        <line
          key={i}
          x1={i * 20 + 10}
          y1="196"
          x2={i * 20 + 10}
          y2={i % 5 === 0 ? 206 : 201}
          stroke={night ? "rgba(255,255,255,.3)" : "rgba(22,27,31,.2)"}
        />
      ))}
    </svg>
  );
}

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
        tone === "sun" ? "bg-sun text-foreground" : "bg-card/85 text-foreground ring-1 ring-black/5",
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
      className={cn("relative overflow-hidden rounded-2xl border", night ? "text-white" : "text-foreground")}
      style={{ background: sky[part] }}
    >
      <Scene part={part} progress={day?.sunProgress ?? 0.5} />
      <div className="relative max-w-xl px-7 pt-7 pb-9 md:px-9">
        <div className={cn("font-mono text-xs", night ? "text-white/75" : "text-muted-foreground")}>
          {day?.dateLabel ?? " "}
        </div>
        <h1 className="mt-2 animate-enter text-3xl font-bold tracking-tight text-balance md:text-4xl">
          {heading}
        </h1>
        {subtitle && (
          <p className={cn("mt-2 max-w-lg text-base", night ? "text-white/85" : "text-foreground/75")}>
            {subtitle}
          </p>
        )}
        {chips && <div className="mt-4 flex flex-wrap gap-2">{chips}</div>}
        {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}
