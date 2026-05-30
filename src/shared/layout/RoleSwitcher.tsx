"use client";

import { UserCog } from "lucide-react";
import { useSessionStore } from "@/stores/session-store";
import { Select } from "@/shared/ui";
import type { Role } from "@/shared/types/domain";

const roles: { value: Role; label: string }[] = [
  { value: "admin", label: "Администратор" },
  { value: "organizer", label: "Организатор" },
  { value: "tutor", label: "Преподаватель" },
  { value: "student", label: "Студент" },
];

export function RoleSwitcher() {
  const role = useSessionStore((s) => s.role);
  const setRole = useSessionStore((s) => s.setRole);

  return (
    <div className="flex items-center gap-2">
      <UserCog size={14} className="text-muted-foreground" />
      <Select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className="h-8 text-xs"
        aria-label="Сменить роль"
      >
        {roles.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
