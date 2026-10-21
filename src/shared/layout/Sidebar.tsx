"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { navForRole } from "@/shared/auth/permissions";
import { roleMeta } from "@/shared/auth/role-meta";

export function Sidebar() {
  const role = useSessionStore((s) => s.role);
  const meta = roleMeta[role];
  const pathname = usePathname();
  const items = navForRole(role);
  const main = items.filter((i) => i.group === "main");
  const admin = items.filter((i) => i.group === "admin");

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r bg-card/60 glass">
      <div className="border-b px-5 py-5">
        <div className="flex items-center gap-2">
          <div
            className={`h-9 w-9 rounded-lg bg-linear-to-br ${meta.gradient} flex items-center justify-center text-white shadow-soft`}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div className="leading-tight font-semibold">HeliosEDU</div>
            <div className="text-[11px] text-muted-foreground">ПНИПУ · ИНЭК</div>
          </div>
        </div>
        <div className={`mt-3 text-[11px] font-medium tracking-wider uppercase ${meta.accentText}`}>
          {meta.workspace}
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <NavGroup label="Основное" items={main} pathname={pathname} />
        {admin.length > 0 && <NavGroup label="Администрирование" items={admin} pathname={pathname} />}
      </nav>

      <div className="border-t px-5 py-3 text-[11px] text-muted-foreground">v0.1 · mockup</div>
    </aside>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: ReturnType<typeof navForRole>;
  pathname: string;
}) {
  return (
    <div>
      <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
        {label}
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-foreground/80 hover:bg-muted",
                )}
              >
                <Icon
                  size={16}
                  className={cn(
                    "shrink-0",
                    active ? "" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
