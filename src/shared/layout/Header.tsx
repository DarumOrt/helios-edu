"use client";

import Link from "next/link";
import { useSession } from "@/shared/auth/session";
import { Avatar, Button } from "@/shared/ui";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { api } from "@/shared/lib/api-client";
import { roleMeta } from "@/shared/auth/role-meta";
import { RoleSwitcher } from "./RoleSwitcher";
import { DataSourceToggle } from "./DataSourceToggle";
import { NotificationsBell } from "@/features/notifications/components/NotificationsBell";

export function Header() {
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.role);
  const backendEnabled = useSession((s) => s.backendEnabled);
  const dataSource = useSession((s) => s.dataSource);
  const [pending, setPending] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  async function logout() {
    // В демо сессии на сервере нет — «выход» возвращает к выбору, кем войти.
    if (!backendEnabled) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Как и при серверном выходе: новый документ сбрасывает SWR-кэш прошлой роли.
      window.location.assign("/login");
      return;
    }
    setPending(true);
    setLogoutError("");
    try {
      await api.post("/api/auth/logout", {});
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- При выходе очищаем SWR и состояние пользователя вместе с документом.
      window.location.assign("/login");
    } catch {
      setPending(false);
      setLogoutError("Не удалось выйти. Попробуйте ещё раз.");
    }
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center justify-end gap-2 bg-background px-4 py-2 sm:px-8">
      <DataSourceToggle state={dataSource} className="mr-auto sm:mr-2" />
      <RoleSwitcher />
      <NotificationsBell />
      <Link
        href="/profile"
        className="flex items-center gap-2.5 rounded-md py-1 pr-2 pl-1 transition-colors hover:bg-muted"
      >
        <Avatar name={user.name} size={32} />
        <div className="hidden text-right sm:block">
          <div className="text-sm leading-tight font-medium">{user.name}</div>
          <div className="text-xs text-muted-foreground">
            {roleMeta[role].label}
            {user.group ? ` · ${user.group}` : ""}
          </div>
        </div>
      </Link>
      <Button variant="ghost" size="sm" onClick={logout} disabled={pending}>
        <LogOut size={16} aria-hidden />
        {pending ? "Выходим…" : "Выйти"}
      </Button>
      {logoutError && (
        <span role="alert" className="text-xs text-danger">
          {logoutError}
        </span>
      )}
    </header>
  );
}
