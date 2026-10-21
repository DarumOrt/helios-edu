"use client";

import Link from "next/link";
import { useSessionStore } from "@/stores/session-store";
import { Avatar } from "@/shared/ui";
import { roleMeta } from "@/shared/auth/role-meta";
import { RoleSwitcher } from "./RoleSwitcher";
import { NotificationsBell } from "@/features/notifications/components/NotificationsBell";

export function Header() {
  const user = useSessionStore((s) => s.user);
  const role = useSessionStore((s) => s.role);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-2 bg-background px-8">
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
    </header>
  );
}
