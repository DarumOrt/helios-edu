"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/session-store";
import { ApiError, fetcher } from "@/shared/lib/api-client";
import { type User, type Role } from "@/shared/types/domain";

const SessionContext = createContext<User | null>(null);

export function SessionProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const { data, error } = useSWR<User>(initialUser ? "/api/auth/me" : null, fetcher, {
    fallbackData: initialUser ?? undefined,
    refreshInterval: 60_000,
    shouldRetryOnError: false,
  });
  const expired = error instanceof ApiError && error.status === 401;
  useEffect(() => {
    if (expired) router.replace("/login");
  }, [expired, router]);
  if (expired) return <p className="p-8 text-muted-foreground">Сессия завершена. Переходим ко входу…</p>;
  return (
    <SessionContext.Provider value={initialUser ? (data ?? initialUser) : null}>
      {children}
    </SessionContext.Provider>
  );
}

interface SessionState {
  user: User;
  role: Role;
  backendEnabled: boolean;
  setRole: (role: Role) => void;
}

export function useSession<T>(selector: (session: SessionState) => T): T {
  const user = useContext(SessionContext);
  // Zustand используется только в прежнем демонстрационном режиме, серверная сессия — SWR.
  const demo = useSessionStore();
  return selector(
    user
      ? { user, role: user.role, backendEnabled: true, setRole: () => {} }
      : { ...demo, backendEnabled: false },
  );
}
