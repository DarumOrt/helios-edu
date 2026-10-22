"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Plus, Edit2 } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import {
  PageHeader,
  DataState,
  Card,
  Table,
  THead,
  TR,
  TH,
  TD,
  Button,
  Badge,
  CourseCover,
} from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { CourseDialog } from "@/features/admin/components/CourseDialog";
import { courseStatusMeta } from "@/features/admin/labels";
import type { Course, User } from "@/shared/types/domain";

export default function AdminCoursesPage() {
  const role = useSession((s) => s.role);
  const { data, error, isLoading } = useSWR<Course[]>("/api/courses", fetcher);
  const { data: users } = useSWR<User[]>("/api/users", fetcher);
  // undefined — окно закрыто, null — новый курс
  const [editing, setEditing] = useState<Course | null | undefined>(undefined);
  const canManage = can(role, "course.create");

  const tutors = (users ?? []).filter((u) => u.role === "tutor" && u.status !== "blocked");
  const tutorName = (id: string) => users?.find((u) => u.id === id)?.name ?? "—";
  const categories = [...new Set((data ?? []).map((c) => c.category))];

  return (
    <div>
      <PageHeader
        title="Управление курсами"
        subtitle={data ? `${data.length} курсов` : undefined}
        actions={
          canManage && (
            <Button onClick={() => setEditing(null)}>
              <Plus size={16} aria-hidden />
              Создать курс
            </Button>
          )
        }
      />
      <Card className="overflow-hidden">
        <DataState loading={isLoading} error={error} empty={!data?.length} emptyTitle="Курсов пока нет">
          <Table>
            <THead>
              <TR>
                <TH>Курс</TH>
                <TH>Преподаватель</TH>
                <TH>Студентов</TH>
                <TH>Статус</TH>
                <TH>
                  <span className="sr-only">Действия</span>
                </TH>
              </TR>
            </THead>
            <tbody>
              {data?.map((c) => {
                const status = courseStatusMeta[c.status ?? "published"];
                return (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/courses/${c.id}`} className="group flex items-center gap-3">
                        <CourseCover course={c} variant="thumb" className="h-8 w-12 shrink-0 rounded-md" />
                        <div>
                          <div className="font-medium group-hover:text-primary">{c.title}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {c.code} · {c.category}
                          </div>
                        </div>
                      </Link>
                    </TD>
                    <TD>{tutorName(c.tutorId)}</TD>
                    <TD className="font-mono tabular-nums">{c.enrolled}</TD>
                    <TD>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </TD>
                    <TD className="text-right">
                      {canManage && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                          <Edit2 size={13} aria-hidden />
                          Редактировать
                        </Button>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </DataState>
      </Card>
      {editing !== undefined && (
        <CourseDialog
          key={editing?.id ?? "new"}
          open
          onClose={() => setEditing(undefined)}
          course={editing ?? undefined}
          tutors={tutors}
          categories={categories}
        />
      )}
    </div>
  );
}
