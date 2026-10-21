"use client";

import Link from "next/link";
import { useSessionStore } from "@/stores/session-store";
import { Avatar, Badge } from "@/shared/ui";
import { RoleSwitcher } from "./RoleSwitcher";
import { NotificationsBell } from "@/features/notifications/components/NotificationsBell";
import type { Role } from "@/shared/types/domain";

const roleLabel: Record<Role, string> = {
  admin: "Администратор",
  organizer: "Организатор",
  tutor: "Преподаватель",
  student: "Студент",
};

const roleTone: Record<Role, "primary" | "info" | "success" | "warning"> = {
  admin: "warning",
  organizer: "info",
  tutor: "primary",
  student: "success",
};

export function Header() {
  const user = useSessionStore((s) => s.user);
  const role = useSessionStore((s) => s.role);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/70 px-8 py-3 glass">
      <Link
        href="/profile"
        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-muted/60"
      >
        <Avatar name={user.name} size={36} />
        <div>
          <div className="text-sm leading-tight font-medium">{user.name}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge tone={roleTone[role]}>{roleLabel[role]}</Badge>
            {user.faculty && (
              <span className="text-[11px] text-muted-foreground">
                {user.faculty}
                {user.group ? ` · ${user.group}` : ""}
              </span>
            )}
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-3">
        <NotificationsBell />
        <RoleSwitcher />
      </div>
    </header>
  );
}
