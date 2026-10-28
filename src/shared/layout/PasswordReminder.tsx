"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useSession } from "@/shared/auth/session";

/** Вошёл по временному паролю (выдан при создании или сбросе) — просим сменить его на свой. */
export function PasswordReminder() {
  const temporary = useSession((s) => Boolean(s.user.mustChangePassword));
  const pathname = usePathname();
  if (!temporary || pathname === "/profile") return null;
  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning"
    >
      <KeyRound size={16} aria-hidden />
      <span className="flex-1">
        Вы вошли по временному паролю. Придумайте свой — так учётная запись будет защищена.
      </span>
      <Link href="/profile#password" className="font-medium underline underline-offset-4">
        Сменить пароль
      </Link>
    </div>
  );
}
