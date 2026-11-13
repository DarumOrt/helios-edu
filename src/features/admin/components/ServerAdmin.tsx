"use client";

import { type ReactNode } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import { type DataSourceState } from "@/shared/lib/data-source";
import { RoleGate } from "@/shared/auth/RoleGate";
import { Card, DataState } from "@/shared/ui";

export function ServerAdmin({ children }: { children: ReactNode }) {
  const { data, error, isLoading } = useSWR<DataSourceState>("/api/data-source", fetcher);
  return (
    <RoleGate roles={["admin"]} fallback={<p>Раздел доступен только администратору.</p>}>
      <DataState loading={isLoading} error={error}>
        {data?.source === "server"
          ? children
          : data && <Card className="p-6">Доступно в режиме «Сервер». Выберите его в шапке платформы.</Card>}
      </DataState>
    </RoleGate>
  );
}
