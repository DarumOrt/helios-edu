"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { BrandMark } from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { navForRole } from "@/shared/auth/permissions";
import { roleMeta } from "@/shared/auth/role-meta";
import { useUiStore } from "@/stores/ui-store";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Sidebar() {
  const role = useSession((s) => s.role);
  const meta = roleMeta[role];
  const pathname = usePathname();
  const items = navForRole(role);
  const main = items.filter((i) => i.group === "main");
  const admin = items.filter((i) => i.group === "admin");
  const open = useUiStore((s) => s.drawerOpen);
  const setOpen = useUiStore((s) => s.setDrawerOpen);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      {/* На телефоне и планшете меню выезжает поверх страницы; на компьютере стоит сбоку всегда. */}
      {open && <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={close} aria-hidden />}
      <aside
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col bg-card shadow-card transition-[transform,visibility] duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full max-lg:invisible",
        )}
      >
        <div className="flex items-start justify-between px-5 pt-6 pb-5">
          <Link href="/dashboard" onClick={close} className="flex items-center gap-3 text-primary">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
              <BrandMark size={26} />
            </span>
            <div>
              <div className="text-lg leading-tight font-bold tracking-tight text-foreground">HeliosEDU</div>
              <div className="font-mono text-xs text-muted-foreground">ПНИПУ · ИНЭК</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label="Закрыть меню"
            className="-mr-2 rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-2" aria-label="Основная навигация">
          <NavGroup label={meta.workspace} items={main} pathname={pathname} onNavigate={close} />
          {admin.length > 0 && (
            <NavGroup label="Администрирование" items={admin} pathname={pathname} onNavigate={close} />
          )}
        </nav>
      </aside>
    </>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  items: ReturnType<typeof navForRole>;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 px-3 text-xs font-medium text-muted-foreground">{label}</div>
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98]",
                  active
                    ? "bg-primary font-medium text-primary-foreground shadow-[0_6px_16px_-8px_hsl(var(--primary))]"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon size={18} className={cn("shrink-0", !active && "text-muted-foreground")} />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
