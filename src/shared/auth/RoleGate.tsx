"use client";

import type { ReactNode } from "react";
import { useSessionStore } from "@/stores/session-store";
import type { Role } from "@/shared/types/domain";

export function RoleGate({
  roles,
  fallback = null,
  children,
}: {
  roles: Role[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const role = useSessionStore((s) => s.role);
  if (!roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
