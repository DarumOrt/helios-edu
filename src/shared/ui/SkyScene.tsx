"use client";

import type { DayPart } from "@/shared/lib/use-day-part";

// Небо приветствия (кабинет и страницы входа). Небо и положение солнца показывают реальное время суток —
// это единственное место в продукте, где разрешён градиент: он несёт смысл, а не украшает.

export const sky: Record<DayPart, string> = {
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

export function SkyScene({ part, progress }: { part: DayPart; progress: number }) {
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
