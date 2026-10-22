"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Edit2, Search } from "lucide-react";
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
  Avatar,
  Input,
  Select,
} from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { canManageUser } from "@/shared/auth/management";
import { UserDialog } from "@/features/admin/components/UserDialog";
import { roleLabel } from "@/features/admin/labels";
import type { Cohort, Role, User } from "@/shared/types/domain";

const roleTone: Record<Role, "warning" | "info" | "primary" | "success"> = {
  admin: "warning",
  organizer: "info",
  tutor: "primary",
  student: "success",
};

export default function AdminUsersPage() {
  const actor = useSession((s) => s.user);
  const { data, error, isLoading } = useSWR<User[]>("/api/users", fetcher);
  const { data: cohorts } = useSWR<Cohort[]>("/api/cohorts", fetcher);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<Role | "">("");
  // undefined — окно закрыто, null — новый пользователь
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const canCreate = can(actor.role, "user.manage");

  const q = query.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (u) =>
      (!role || u.role === role) &&
      (!q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.group?.toLowerCase().includes(q)),
  );

  return (
    <div>
      <PageHeader
        title="Пользователи"
        subtitle={data ? `${data.length} учётных записей` : undefined}
        actions={
          canCreate && (
            <Button onClick={() => setEditing(null)}>
              <Plus size={16} aria-hidden />
              Добавить пользователя
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search
            size={16}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="Поиск пользователя"
            placeholder="Имя, почта или группа"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select aria-label="Роль" value={role} onChange={(e) => setRole(e.target.value as Role | "")}>
          <option value="">Все роли</option>
          {(Object.keys(roleLabel) as Role[]).map((r) => (
            <option key={r} value={r}>
              {roleLabel[r]}
            </option>
          ))}
        </Select>
      </div>
      <Card className="overflow-hidden">
        <DataState
          loading={isLoading}
          error={error}
          empty={!rows.length}
          emptyTitle={data?.length ? "Никого не нашли" : "Пользователей пока нет"}
        >
          <Table>
            <THead>
              <TR>
                <TH>Пользователь</TH>
                <TH>Почта</TH>
                <TH>Группа</TH>
                <TH>Роль</TH>
                <TH>
                  <span className="sr-only">Действия</span>
                </TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((u) => {
                const manageable = canManageUser(actor, u);
                return (
                  <TR key={u.id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} size={32} />
                        <span className="font-medium">{u.name}</span>
                        {u.id === actor.id && <Badge tone="outline">вы</Badge>}
                        {u.status === "blocked" && <Badge tone="danger">заблокирован</Badge>}
                      </div>
                    </TD>
                    <TD className="text-muted-foreground">{u.email}</TD>
                    <TD>{u.group ?? "—"}</TD>
                    <TD>
                      <Badge tone={roleTone[u.role]}>{roleLabel[u.role]}</Badge>
                    </TD>
                    <TD className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(u)}
                        disabled={!manageable}
                        title={
                          manageable
                            ? undefined
                            : "Учётные записи администраторов меняет только администратор"
                        }
                      >
                        <Edit2 size={13} aria-hidden />
                        Изменить
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </DataState>
      </Card>
      {editing !== undefined && (
        <UserDialog
          key={editing?.id ?? "new"}
          open
          onClose={() => setEditing(undefined)}
          user={editing ?? undefined}
          actor={actor}
          cohorts={cohorts ?? []}
        />
      )}
    </div>
  );
}
