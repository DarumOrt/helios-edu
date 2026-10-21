"use client";

import { useSession } from "@/shared/auth/session";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { EmptyState } from "@/shared/ui";

const tabs = [
  { href: "/admin/courses", label: "Курсы" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/cohorts", label: "Группы" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = useSession((s) => s.role);
  const pathname = usePathname();

  if (role !== "admin" && role !== "organizer") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Доступ ограничен"
        description="Раздел доступен только администраторам и организаторам. Переключите роль в шапке для просмотра."
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm transition",
                active
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
