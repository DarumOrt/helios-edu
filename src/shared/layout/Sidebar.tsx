"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { BrandIdentity } from "@/shared/layout/BrandIdentity";
import { useSession } from "@/shared/auth/session";
import { useBranding } from "@/shared/lib/branding";
import { navForRole, can } from "@/shared/auth/permissions";
import { roleMeta } from "@/shared/auth/role-meta";
import { useUiStore } from "@/stores/ui-store";
import { Pencil, X } from "lucide-react";
import { useEffect, useRef } from "react";

export function Sidebar() {
  const role = useSession((s) => s.role);
  const backend = useSession((s) => s.backendEnabled);
  const { data } = useBranding();
  const showEdit = useUiStore((s) => s.editingBrand) && backend && can(role, "system.manage");
  const setBrandingOpen = useUiStore((s) => s.setBrandingOpen);
  const meta = roleMeta[role];
  const pathname = usePathname();
  const items = navForRole(role);
  const main = items.filter((i) => i.group === "main");
  const admin = items.filter((i) => i.group === "admin");
  const open = useUiStore((s) => s.drawerOpen);
  const setOpen = useUiStore((s) => s.setDrawerOpen);
  const close = () => setOpen(false);
  const sidebar = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;
    const desktop = window.matchMedia("(min-width: 64rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    const focusMenu = () => {
      if (!sidebar.current?.contains(document.activeElement)) {
        closeButton.current?.focus({ preventScroll: true });
      }
    };
    const focusFrame = window.requestAnimationFrame(focusMenu);
    // Если кнопка ещё скрыта на первом кадре, переводим фокус после выезда панели.
    const focusAfterSlide = window.setTimeout(focusMenu, 200);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "Tab") {
        const focusable = sidebar.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)");
        const first = focusable?.[0];
        const last = focusable?.[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", closeOnDesktop);
    closeOnDesktop();
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.clearTimeout(focusAfterSlide);
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", closeOnDesktop);
      if (!desktop.matches && trigger instanceof HTMLElement) trigger.focus();
    };
  }, [open, setOpen]);

  return (
    <>
      {/* На телефоне и планшете меню выезжает поверх страницы; на компьютере стоит сбоку всегда. */}
      {open && <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={close} aria-hidden />}
      <aside
        ref={sidebar}
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col border-r bg-card shadow-card motion-safe:transition-[transform,visibility] motion-safe:duration-200 motion-safe:ease-out lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full max-lg:invisible",
        )}
      >
        <div className="group relative flex items-start justify-between px-5 pt-6 pb-5">
          <Link
            href="/dashboard"
            onClick={close}
            tabIndex={showEdit ? -1 : undefined}
            aria-hidden={showEdit || undefined}
            className="flex min-w-0 items-center gap-3 text-foreground"
          >
            <BrandIdentity branding={data} compact />
          </Link>
          {showEdit && (
            <button
              type="button"
              onClick={() => {
                close();
                setBrandingOpen(true);
              }}
              aria-label="Изменить логотип и подпись"
              className="absolute inset-y-4 right-12 left-3 flex items-end justify-end rounded-lg border border-dashed border-primary/45 p-1 text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring lg:right-3"
            >
              <span className="grid size-6 place-items-center rounded-md bg-card shadow-sm">
                <Pencil size={14} aria-hidden />
              </span>
            </button>
          )}
          <button
            ref={closeButton}
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
                    ? "bg-primary-soft font-semibold text-primary ring-1 ring-primary/15 ring-inset"
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
