"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  getServerThemePreference,
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from "@/shared/lib/theme";

const steps: Record<ThemePreference, { next: ThemePreference; label: string; icon: typeof Sun }> = {
  system: { next: "light", label: "как в системе", icon: Monitor },
  light: { next: "dark", label: "светлая", icon: Sun },
  dark: { next: "system", label: "тёмная", icon: Moon },
};

// Кнопка по кругу: как в системе → светлая → тёмная.
export function ThemeToggle() {
  const pref = useSyncExternalStore(subscribeTheme, getThemePreference, getServerThemePreference);
  const { next, label, icon: Icon } = steps[pref];
  return (
    <button
      type="button"
      onClick={() => setThemePreference(next)}
      aria-label={`Тема: ${label}. Переключить на «${steps[next].label}»`}
      title={`Тема: ${label}`}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
