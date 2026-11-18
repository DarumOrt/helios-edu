"use client";

import { useSession } from "@/shared/auth/session";
import { Select } from "@/shared/ui";
import type { Role } from "@/shared/types/domain";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { api, apiErrorInfo } from "@/shared/lib/api-client";
import { can } from "@/shared/auth/permissions";
import { mutate } from "swr";

const roles: { value: Role; label: string }[] = [
  { value: "admin", label: "Администратор" },
  { value: "organizer", label: "Организатор" },
  { value: "tutor", label: "Преподаватель" },
  { value: "student", label: "Студент" },
];

export function RoleSwitcher() {
  const role = useSession((s) => s.role);
  const setRole = useSession((s) => s.setRole);
  const backendEnabled = useSession((s) => s.backendEnabled);
  const preview = useSession((s) => s.user.previewContext);
  if (backendEnabled)
    return can(role, "system.manage") || preview ? (
      <ServerRoleSwitcher role={role} active={Boolean(preview)} />
    ) : null;

  return (
    <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground sm:mr-2">
      <span className="max-sm:sr-only">демо-роль</span>
      <Select
        value={role}
        onChange={(e) => {
          setRole(e.target.value as Role);
          // данные прошлой роли (курсы, поиск, оценки) перезапрашиваются под новой
          void mutate(() => true);
        }}
        className="h-8 border-dashed bg-transparent text-xs max-sm:w-28"
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

function ServerRoleSwitcher({ role, active }: { role: Role; active: boolean }) {
  const [pending, setPending] = useState(false);
  const path = usePathname();
  async function change(nextRole: string) {
    setPending(true);
    const match = path.match(/^\/courses\/([^/]+)/);
    const courseId = match && match[1] !== "trash" ? decodeURIComponent(match[1]) : null;
    try {
      if (nextRole === "admin") await api.del("/api/auth/preview");
      else await api.post("/api/auth/preview", { role: nextRole, courseId });
      const destination =
        nextRole === "admin" ? "/dashboard" : "/courses/" + encodeURIComponent(courseId ?? "preview-course");
      // В открытой копии после навигации на другой экран курс можно снова выбрать из списка.
      window.location.assign(
        new URL(active && !courseId ? "/dashboard" : destination, window.location.origin),
      );
    } catch (error) {
      toast.error(apiErrorInfo(error).error ?? "Не удалось переключить роль. Попробуйте ещё раз.");
      setPending(false);
    }
  }

  return (
    <div
      className={
        active
          ? "flex flex-wrap items-center gap-2 max-sm:order-last max-sm:w-full max-sm:justify-between"
          : "flex items-center"
      }
    >
      <label className="flex items-center gap-2 text-xs">
        <span className={active ? "font-medium text-primary" : "sr-only"}>
          {active ? (
            <>
              <span className="sm:hidden">Копия</span>
              <span className="max-sm:hidden">Проверочная копия</span>
            </>
          ) : (
            "Проверить роль"
          )}
        </span>
        <Select
          aria-label="Проверить роль"
          className="h-8 max-w-40 text-xs max-sm:max-w-32"
          disabled={pending}
          value={active ? role : ""}
          onChange={(e) => void change(e.target.value)}
        >
          {!active && (
            <option value="" disabled>
              Проверить роль…
            </option>
          )}
          {roles
            .filter((r) => r.value !== "admin")
            .map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
        </Select>
      </label>
      {active && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void change("admin")}
          aria-label="Вернуться к администрированию"
          title="Завершить проверку и удалить копию курса"
          className="rounded px-2 py-1 text-xs text-primary underline"
        >
          <span className="sm:hidden">Завершить проверку</span>
          <span className="max-sm:hidden">Вернуться к администрированию</span>
        </button>
      )}
    </div>
  );
}
