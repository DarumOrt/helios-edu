"use client";

import type { ReactNode } from "react";
import { useSessionStore } from "@/stores/session-store";
import { roleMeta } from "@/shared/auth/role-meta";

export function RoleHero({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const role = useSessionStore((s) => s.role);
  const meta = roleMeta[role];

  return (
    <div className="relative overflow-hidden rounded-xl border shadow-soft">
      <div className={`absolute inset-0 bg-linear-to-br ${meta.gradient}`} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 240px at 100% 0%, rgba(255,255,255,0.18), transparent), linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.42))",
        }}
      />
      <div className="relative px-8 py-8 text-white">
        {kicker && <div className="text-[11px] tracking-[0.18em] uppercase opacity-85">{kicker}</div>}
        <h2 className="mt-1.5 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-white/85">{subtitle}</p>}
        {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
