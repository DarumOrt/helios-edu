"use client";

import { useSyncExternalStore } from "react";

export type DayPart = "morning" | "day" | "evening" | "night";

export interface DayInfo {
  part: DayPart;
  /** 0..1 — где солнце на дуге между восходом (6:00) и закатом (21:00) */
  sunProgress: number;
  greeting: string;
  dateLabel: string;
  /** 1 — понедельник … 7 — воскресенье */
  weekday: number;
  /** минуты от начала суток */
  minutes: number;
}

// Снимок — примитив с точностью до минуты: стабилен между рендерами и меняется раз в минуту.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

function getSnapshot() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}

// На сервере времени пользователя нет — рендерим нейтральное приветствие, клиент уточнит.
function getServerSnapshot() {
  return null;
}

const greetings: Record<DayPart, string> = {
  morning: "Доброе утро",
  day: "Добрый день",
  evening: "Добрый вечер",
  night: "Доброй ночи",
};

function partOf(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function useDayPart(): DayInfo | null {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!snap) return null;
  const [y, m, day, h, min] = snap.split("-").map(Number);
  const date = new Date(y, m, day, h, min);
  const part = partOf(h);
  const minutes = h * 60 + min;
  const sunProgress = Math.min(1, Math.max(0, (minutes - 6 * 60) / (15 * 60)));
  const dateLabel = date.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  return {
    part,
    sunProgress,
    greeting: greetings[part],
    dateLabel: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
    weekday: date.getDay() === 0 ? 7 : date.getDay(),
    minutes,
  };
}
