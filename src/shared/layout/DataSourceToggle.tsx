"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Database, FlaskConical, type LucideIcon } from "lucide-react";
import { api } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/utils";
import { useSession } from "@/shared/auth/session";
import { useSessionStore } from "@/stores/session-store";
import type { DataSource, DataSourceState } from "@/shared/lib/data-source";

const options: { value: DataSource; label: string; icon: LucideIcon; hint: string }[] = [
  {
    value: "demo",
    label: "Демо",
    icon: FlaskConical,
    hint: "Демонстрационные данные: вход выбором роли, изменения живут до перезапуска",
  },
  {
    value: "server",
    label: "Сервер",
    icon: Database,
    hint: "Данные из базы университета: вход по почте и паролю",
  },
];

// Переключатель источника данных — инструмент показа, оформлен как служебный (как и демо-роль).
// После переключения страница перезагружается: сервер заново решает, нужен ли вход.
// В демо вход — выбором роли; переходя с сервера, остаёмся в той же роли, а не в последней выбранной.
export function DataSourceToggle({ state, className }: { state: DataSourceState; className?: string }) {
  const [pending, setPending] = useState<DataSource | null>(null);
  const role = useSession((s) => s.role);

  async function choose(source: DataSource) {
    if (source === state.source || pending) return;
    setPending(source);
    try {
      await api.post("/api/data-source", { source });
      if (source === "demo") useSessionStore.getState().setRole(role);
      window.location.reload();
    } catch {
      setPending(null);
      toast.error("Не удалось переключить данные", {
        description: "Обновите страницу — обычно это помогает",
      });
    }
  }

  return (
    <div
      role="group"
      aria-label="Источник данных"
      className={cn("inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5", className)}
    >
      <span className="px-2 font-mono text-xs text-muted-foreground">данные</span>
      {options.map(({ value, label, icon: Icon, hint }) => {
        const active = (pending ?? state.source) === value;
        const unavailable =
          (value === "server" && !state.serverAvailable) || (value === "demo" && !state.demoAllowed);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            disabled={unavailable || pending !== null}
            title={unavailable ? (value === "server" ? "Сервер не подключён" : "Демо-режим отключён") : hint}
            onClick={() => choose(value)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-[color,background-color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden active:scale-[0.97] disabled:cursor-not-allowed",
              active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
              unavailable && "opacity-50",
            )}
          >
            <Icon size={14} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
