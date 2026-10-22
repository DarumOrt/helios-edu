"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/shared/ui";
import { roleMeta } from "@/shared/auth/role-meta";
import { usersByRole, useSessionStore } from "@/stores/session-store";
import type { Role } from "@/shared/types/domain";

const order: Role[] = ["student", "tutor", "organizer", "admin"];

// Вход в демо-режиме: пароль не нужен, выбираем, чьими глазами смотреть на систему.
export function DemoLogin() {
  const router = useRouter();
  const setRole = useSessionStore((s) => s.setRole);
  const current = useSessionStore((s) => s.user);
  // Сессия демо хранится в localStorage — на сервере её нет, поэтому показываем только после гидратации.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // пользователь, созданный демо-регистрацией, — его можно продолжить
  const registered = hydrated && current.id.startsWith("u-demo-") ? current : null;

  function enter(role: Role) {
    setRole(role);
    router.push("/dashboard");
  }

  return (
    <section aria-labelledby="login-title">
      <h1 id="login-title" className="text-2xl leading-tight font-semibold text-balance">
        Вход в личный кабинет
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Демо-режим: выберите, кем войти. Пароль не нужен, данные учебные.
      </p>

      {registered && (
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="group mt-6 flex w-full items-center gap-3 rounded-xl bg-primary px-4 py-3 text-left text-primary-foreground transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.97]"
        >
          <Avatar name={registered.name} size={40} className="border-white/30 bg-white/15 text-white" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">Продолжить как {registered.name}</span>
            <span className="block truncate text-xs text-primary-foreground/80">{registered.email}</span>
          </span>
          <ChevronRight size={18} aria-hidden />
        </button>
      )}

      <ul className="mt-6 space-y-2" aria-label="Демо-пользователи">
        {order.map((role) => {
          const user = usersByRole[role];
          const meta = roleMeta[role];
          return (
            <li key={role}>
              <button
                type="button"
                onClick={() => enter(role)}
                className="group flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-elevate focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden active:scale-[0.97]"
              >
                <Avatar name={user.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {meta.label} · {meta.workspace}
                    {user.group ? ` · ${user.group}` : ""}
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  aria-hidden
                  className="text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Хотите посмотреть путь нового студента?{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Зарегистрируйтесь
        </Link>
      </p>
    </section>
  );
}
