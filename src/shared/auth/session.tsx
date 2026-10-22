"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/session-store";
import { ApiError, fetcher } from "@/shared/lib/api-client";
import { type User, type Role } from "@/shared/types/domain";
import { type DataSourceState } from "@/shared/lib/data-source";

const SessionContext = createContext<User | null>(null);
const DataSourceContext = createContext<DataSourceState>({
  source: "demo",
  serverAvailable: false,
  demoAllowed: true,
});

export function SessionProvider({
  initialUser,
  dataSource,
  children,
}: {
  initialUser: User | null;
  dataSource: DataSourceState;
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
    <DataSourceContext.Provider value={dataSource}>
      <SessionContext.Provider value={initialUser ? (data ?? initialUser) : null}>
        {children}
      </SessionContext.Provider>
    </DataSourceContext.Provider>
  );
}

interface SessionState {
  user: User;
  role: Role;
  backendEnabled: boolean;
  dataSource: DataSourceState;
  setRole: (role: Role) => void;
}

export function useSession<T>(selector: (session: SessionState) => T): T {
  const user = useContext(SessionContext);
  const dataSource = useContext(DataSourceContext);
  // Zustand используется только в демо-режиме, серверная сессия — SWR.
  const demo = useSessionStore();
  return selector(
    user
      ? { user, role: user.role, backendEnabled: true, dataSource, setRole: () => {} }
      : { ...demo, backendEnabled: false, dataSource },
  );
}
