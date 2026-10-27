"use client";

import useSWR from "swr";
import { UsersRound } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { useSession } from "@/shared/auth/session";
import { Avatar, DataState } from "@/shared/ui";
import type { Classmate } from "@/shared/types/domain";
import { Widget } from "./Widget";

/** Одногруппники: учёба — не только материалы, но и люди рядом. Почту API не отдаёт — это личные данные. */
export function Classmates() {
  const user = useSession((s) => s.user);
  const { data, error, isLoading } = useSWR<Classmate[]>(
    user.group ? `/api/users?group=${encodeURIComponent(user.group)}` : null,
    fetcher,
  );
  const mates = (data ?? []).filter((u) => u.id !== user.id);

  return (
    <Widget
      title="Одногруппники"
      subtitle={mates.length ? `${mates.length} человек в ${user.group}` : undefined}
      icon={UsersRound}
    >
      <DataState loading={isLoading} error={error} empty={!mates.length} emptyTitle="Пока никого нет">
        <ul className="space-y-1">
          {mates.slice(0, 5).map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/60"
            >
              <Avatar name={m.name} size={36} />
              <div className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}</div>
            </li>
          ))}
        </ul>
      </DataState>
    </Widget>
  );
}
