"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  BookOpen,
  Users as UsersIcon,
  UsersRound,
  GraduationCap,
  Settings2,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Button, Card, Avatar, Badge, DataState, Table, THead, TR, TH, TD } from "@/shared/ui";
import { useSessionStore } from "@/stores/session-store";
import { roleMeta } from "@/shared/auth/role-meta";
import { RoleHero } from "./RoleHero";
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
  const { data: courses } = useSWR<Course[]>("/api/courses", fetcher);
  const { data: users } = useSWR<User[]>("/api/users", fetcher);
  const { data: cohorts } = useSWR<Cohort[]>("/api/cohorts", fetcher);
  const { data: programs } = useSWR<Program[]>("/api/programs", fetcher);

  return (
    <div className="space-y-6">
      <RoleHero
        kicker="Платформа ПНИПУ · ИНЭК"
        title={meta.dashTitle}
        subtitle={meta.dashSubtitle}
        actions={
          <>
            <Link href="/admin/users">
              <Button className="bg-white text-amber-700 hover:bg-white/90">
                <UsersIcon size={16} /> Пользователи
              </Button>
            </Link>
            <Link href="/admin/courses">
              <Button variant="ghost" className="text-white hover:bg-white/10">
                <Settings2 size={16} /> Управление курсами
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={BookOpen} tone="bg-primary-soft text-primary" label="Курсов" value={courses?.length ?? 0} />
        <StatCard icon={UsersIcon} tone="bg-success-soft text-success" label="Пользователей" value={users?.length ?? 0} />
        <StatCard icon={UsersRound} tone="bg-violet-50 text-violet-600" label="Групп" value={cohorts?.length ?? 0} />
        <StatCard icon={GraduationCap} tone="bg-warning-soft text-warning" label="Программ" value={programs?.length ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses?.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="rounded-lg border p-3 hover:bg-muted/40 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{c.code}</span>
                  <Badge tone="outline">{c.category}</Badge>
                </div>
                <div className="font-medium text-sm mt-1 truncate">{c.title}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{c.enrolled} участников</div>
              </Link>
            ))}
          </div>
        </DataState>
      </Widget>
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="p-4 hover:shadow-elevate transition">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-xl font-semibold leading-tight">{value}</div>
        </div>
      </div>
    </Card>
  );
}
