"use client";

import useSWR from "swr";
import { Mail, Building2, UsersRound, Shield, BookOpen, Trophy } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, Card, CardBody, CardHeader, Avatar, Badge, Progress } from "@/shared/ui";
import { useSessionStore } from "@/stores/session-store";
import { roleMeta } from "@/shared/auth/role-meta";
import type { Course } from "@/shared/types/domain";
import type { LeaderboardEntry } from "@/shared/lib/tracking/types";

export default function ProfilePage() {
  const user = useSessionStore((s) => s.user);
  const role = useSessionStore((s) => s.role);
  const meta = roleMeta[role];

  const { data: courses } = useSWR<Course[]>("/api/courses", fetcher);
  const { data: lb } = useSWR<{ entries: LeaderboardEntry[] }>(
    role === "student" ? `/api/hub/leaderboard?courseId=c-matan&userId=${user.id}` : null,
    fetcher
  );
  const me = lb?.entries?.find((e) => e.isCurrentUser);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Профиль" subtitle="Учётная запись и информация" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* карточка пользователя */}
        <Card className="overflow-hidden">
          <div className={`h-20 bg-gradient-to-br ${meta.gradient}`} />
          <CardBody className="-mt-12">
            <div className="ring-4 ring-card rounded-full w-fit">
              <Avatar name={user.name} size={72} />
            </div>
            <h2 className="mt-3 text-lg font-semibold">{user.name}</h2>
            <Badge tone={meta.badgeTone}>{meta.label}</Badge>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5 text-muted-foreground">
                <Mail size={15} /> {user.email}
              </li>
              {user.faculty && (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <Building2 size={15} /> Факультет {user.faculty}
                </li>
              )}
              {user.group && (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <UsersRound size={15} /> Группа {user.group}
                </li>
              )}
              <li className="flex items-center gap-2.5 text-muted-foreground">
                <Shield size={15} /> {meta.workspace}
              </li>
            </ul>
          </CardBody>
        </Card>

        {/* контекст роли */}
        <div className="lg:col-span-2 space-y-4">
          {role === "student" && (
            <>
              <Card>
                <CardHeader title="Моя вовлечённость" subtitle="Математический анализ" icon={<Trophy size={18} />} />
                <CardBody>
                  {me ? (
                    <div className="grid grid-cols-3 gap-4">
                      <Stat label="Место в группе" value={`#${me.rank}`} />
                      <Stat label="Баллов" value={me.score} />
                      <Stat label="Покрытие" value={`${me.avgCoverage}%`} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Начните изучать материалы, чтобы появилась статистика.</p>
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Мои курсы" icon={<BookOpen size={18} />} />
                <CardBody>
                  <ul className="space-y-3">
                    {courses?.slice(0, 4).map((c) => (
                      <li key={c.id} className="flex items-center gap-3">
                        <span className="flex-1 text-sm">{c.title}</span>
                        <Progress value={c.progress ?? 0} className="w-28" />
                        <span className="text-xs text-muted-foreground w-9 text-right">{c.progress ?? 0}%</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </>
          )}

          {role !== "student" && (
            <Card>
              <CardHeader
                title="Зона ответственности"
                subtitle={meta.workspace}
                icon={<Shield size={18} />}
              />
              <CardBody>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                  {(role === "tutor"
                    ? ["Проверка работ группы М1217", "Аналитика изучения материалов", "Журнал оценок", "Ведение курсов"]
                    : ["Управление курсами и программами", "Пользователи и группы", "Аналитика по платформе", "Настройки системы"]
                  ).map((t) => (
                    <li key={t} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                      <span className={`w-1.5 h-1.5 rounded-full bg-current ${meta.accentText}`} />
                      {t}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3 text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
