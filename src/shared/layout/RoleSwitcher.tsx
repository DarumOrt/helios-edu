"use client";

import { useSession } from "@/shared/auth/session";
import { Select } from "@/shared/ui";
import type { Role } from "@/shared/types/domain";

const roles: { value: Role; label: string }[] = [
  { value: "admin", label: "Администратор" },
  { value: "organizer", label: "Организатор" },
  { value: "tutor", label: "Преподаватель" },
  { value: "student", label: "Студент" },
];

// Переключатель роли — инструмент демо, поэтому оформлен как служебный, а не как часть продукта.
export function RoleSwitcher() {
  const role = useSession((s) => s.role);
  const setRole = useSession((s) => s.setRole);
  const backendEnabled = useSession((s) => s.backendEnabled);
  if (backendEnabled) return null;

  return (
    <label className="mr-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
      демо-роль
      <Select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className="h-8 border-dashed bg-transparent text-xs"
      >
        {roles.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
