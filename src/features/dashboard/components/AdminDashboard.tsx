"use client";

import Link from "next/link";
import useSWR from "swr";
import { Users as UsersIcon, Settings2, BarChart3 } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Button, Avatar, Badge, DataState, Table, THead, TR, TH, TD } from "@/shared/ui";
import { useSessionStore } from "@/stores/session-store";
import { roleMeta } from "@/shared/auth/role-meta";
import { RoleHero } from "./RoleHero";
import { FactStrip } from "./FactStrip";
import { Widget } from "./Widget";
import { NotificationsWidget } from "./NotificationsWidget";
import type { Course, User, Cohort, Program, Role } from "@/shared/types/domain";

const roleLabel: Record<Role, string> = {
  admin: "Администратор",
  organizer: "Организатор",
  tutor: "Преподаватель",
  student: "Студент",
};

const roleTone: Record<Role, "warning" | "info" | "primary" | "success"> = {
  admin: "warning",
  organizer: "info",
  tutor: "primary",
  student: "success",
};

export function AdminDashboard() {
  const role = useSessionStore((s) => s.role);
  const meta = roleMeta[role];
  const user = useSessionStore((s) => s.user);
  const { data: courses } = useSWR<Course[]>("/api/courses", fetcher);
  const { data: users } = useSWR<User[]>("/api/users", fetcher);
  const { data: cohorts } = useSWR<Cohort[]>("/api/cohorts", fetcher);
  const { data: programs } = useSWR<Program[]>("/api/programs", fetcher);

  return (
    <div className="space-y-6">
      <RoleHero
        name={user.name.split(" ")[0]}
        subtitle={meta.dashSubtitle}
        actions={
          <>
            <Link href="/admin/users">
              <Button>
                <UsersIcon size={16} /> Пользователи
              </Button>
            </Link>
            <Link href="/admin/courses">
              <Button variant="outline">
                <Settings2 size={16} /> Управление курсами
              </Button>
            </Link>
          </>
        }
      />

      <FactStrip
        facts={[
          { label: "Курсов", value: courses?.length ?? 0, href: "/admin/courses" },
          { label: "Пользователей", value: users?.length ?? 0, href: "/admin/users" },
          { label: "Групп", value: cohorts?.length ?? 0, href: "/admin/cohorts" },
          { label: "Программ", value: programs?.length ?? 0, href: "/programs" },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Widget
            title="Пользователи платформы"
            subtitle="Недавно активные"
            icon={UsersIcon}
            action={
              <Link href="/admin/users" className="text-xs text-primary hover:underline">
                Все
              </Link>
            }
          >
            <DataState empty={!users?.length}>
              <Table>
                <THead>
                  <TR>
                    <TH>Пользователь</TH>
                    <TH>Факультет</TH>
                    <TH>Группа</TH>
                    <TH>Роль</TH>
                  </TR>
                </THead>
                <tbody>
                  {users?.slice(0, 6).map((u) => (
                    <TR key={u.id}>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.name} size={28} />
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </TD>
                      <TD>{u.faculty ?? "—"}</TD>
                      <TD>{u.group ?? "—"}</TD>
                      <TD>
                        <Badge tone={roleTone[u.role]}>{roleLabel[u.role]}</Badge>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </DataState>
          </Widget>
        </div>
        <NotificationsWidget />
      </div>

      <Widget
        title="Курсы платформы"
        subtitle="Сводка по курсам"
        icon={BarChart3}
        action={
          <Link href="/admin/courses" className="text-xs text-primary hover:underline">
            Управление
          </Link>
        }
      >
        <DataState empty={!courses?.length}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {courses?.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="rounded-md border p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                  <Badge tone="outline">{c.category}</Badge>
                </div>
                <div className="mt-1 truncate text-sm font-medium">{c.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{c.enrolled} участников</div>
              </Link>
            ))}
          </div>
        </DataState>
      </Widget>
    </div>
  );
}
