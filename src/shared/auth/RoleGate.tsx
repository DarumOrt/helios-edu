"use client";

import type { ReactNode } from "react";
import { useSession } from "@/shared/auth/session";
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
  const role = useSession((s) => s.role);
  if (!roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
