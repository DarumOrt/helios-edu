"use client";

import useSWR from "swr";
import { Plus, Edit2 } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Card, Table, THead, TR, TH, TD, Button, Badge, Avatar } from "@/shared/ui";
import type { User } from "@/shared/types/domain";

const roleLabel: Record<User["role"], string> = {
  admin: "Администратор",
  organizer: "Организатор",
  tutor: "Преподаватель",
  student: "Студент",
};

const roleTone: Record<User["role"], "warning" | "info" | "primary" | "success"> = {
  admin: "warning",
  organizer: "info",
  tutor: "primary",
  student: "success",
};

export default function AdminUsersPage() {
  const { data, error, isLoading } = useSWR<User[]>("/api/users", fetcher);

  return (
    <div>
      <PageHeader
        title="Пользователи"
        actions={
          <Button>
            <Plus size={16} />
            Добавить пользователя
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <DataState loading={isLoading} error={error} empty={!data?.length}>
          <Table>
            <THead>
              <TR>
                <TH>Пользователь</TH>
                <TH>Email</TH>
                <TH>Факультет</TH>
                <TH>Группа</TH>
                <TH>Роль</TH>
                <TH></TH>
              </TR>
            </THead>
            <tbody>
              {data?.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} size={32} />
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </TD>
                  <TD className="text-muted-foreground">{u.email}</TD>
                  <TD>{u.faculty ?? "—"}</TD>
                  <TD>{u.group ?? "—"}</TD>
                  <TD><Badge tone={roleTone[u.role]}>{roleLabel[u.role]}</Badge></TD>
                  <TD>
                    <Button variant="ghost" size="sm">
                      <Edit2 size={13} />
                      Изменить
                    </Button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </DataState>
      </Card>
    </div>
  );
}
