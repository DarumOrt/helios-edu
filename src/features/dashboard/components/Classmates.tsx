"use client";

import useSWR from "swr";
import { Mail, UsersRound } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { useSession } from "@/shared/auth/session";
import { Avatar, DataState } from "@/shared/ui";
import type { User } from "@/shared/types/domain";
import { Widget } from "./Widget";

/** Одногруппники: учёба — не только материалы, но и люди рядом. */
export function Classmates() {
  const user = useSession((s) => s.user);
  const { data, error, isLoading } = useSWR<User[]>(
    user.group ? `/api/users?group=${encodeURIComponent(user.group)}` : null,
    fetcher,
  );
  const mates = (data ?? []).filter((u) => u.id !== user.id && u.role === "student");

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
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.name}</div>
                <div className="truncate text-xs text-muted-foreground">{m.email}</div>
              </div>
              <a
                href={`mailto:${m.email}`}
                aria-label={`Написать: ${m.name}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform duration-150 ease-out hover:scale-105 active:scale-95"
              >
                <Mail size={16} />
              </a>
            </li>
          ))}
        </ul>
      </DataState>
    </Widget>
  );
}
