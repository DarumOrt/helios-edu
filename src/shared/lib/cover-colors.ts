// Цвета обложек курсов (палитра «Ясное небо»). Цвет выбирается случайно один раз при создании
// курса и хранится в данных курса — так он не «прыгает», если набор цветов поменяется.

export const COVER_COLORS = {
  sky: { label: "Небо", bg: "#1E6FD9", shape: "#FFFFFF" },
  teal: { label: "Бирюза", bg: "#2AA7A1", shape: "#FFFFFF" },
  apricot: { label: "Абрикос", bg: "#FF8A4C", shape: "#14213D" },
  iris: { label: "Ирис", bg: "#7A6FF0", shape: "#FFFFFF" },
  sun: { label: "Солнце", bg: "#F2B53A", shape: "#14213D" },
  rose: { label: "Роза", bg: "#E25B7A", shape: "#FFFFFF" },
} as const;

export type CoverColor = keyof typeof COVER_COLORS;

export const COVER_COLOR_KEYS = Object.keys(COVER_COLORS) as CoverColor[];

export function isCoverColor(v: unknown): v is CoverColor {
  return typeof v === "string" && v in COVER_COLORS;
}

/** Случайный цвет для нового курса. */
export function randomCoverColor(): CoverColor {
  return COVER_COLOR_KEYS[Math.floor(Math.random() * COVER_COLOR_KEYS.length)];
}

/** Запасной вариант для курсов без сохранённого цвета: стабильно по id. */
export function fallbackCoverColor(seed: string): CoverColor {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COVER_COLOR_KEYS[Math.abs(h) % COVER_COLOR_KEYS.length];
}
