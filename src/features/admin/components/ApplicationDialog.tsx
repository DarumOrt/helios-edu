"use client";

import { OrganizerScope } from "./OrganizerScope";
import { can } from "@/shared/auth/permissions";
import { FacultySelect } from "./FacultySelect";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { assignableRoles } from "@/shared/auth/management";
import { useSession } from "@/shared/auth/session";
import type { PendingUser, Role } from "@/shared/types/domain";
import { Button, Dialog, Field, Select, describedBy } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { adminApi, refreshManagement } from "../api";
import { roleLabel } from "../labels";

export function ApplicationDialog({
  application,
  groups,
  onClose,
}: {
  application: PendingUser;
  groups: string[];
  onClose: () => void;
}) {
  const { pending, error, fields, run, reset } = useFormSubmit();
  const actorRole = useSession((s) => s.role);
  const server = useSession((s) => s.dataSource.source === "server");
  const [role, setRole] = useState<Role | "">("");
  const [group, setGroup] = useState("");
  const [faculty, setFaculty] = useState("");
  const [scope, setScope] = useState<string[] | null>(null);
  const [reject, setReject] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const done = await run(async () => {
      if (reject) {
        await adminApi.rejectApplication(application.id);
      } else {
        if (!role) return false;
        await adminApi.approveApplication(application.id, {
          role,
          group: role === "student" ? group || null : null,
          faculty: faculty.trim() || null,
          ...(server &&
            role === "organizer" &&
            can(actorRole, "system.manage") && { organizerFaculties: scope }),
        });
      }
      return true;
    });
    if (!done) return;
    toast.success(
      reject ? "Заявка отклонена" : server ? "Приглашение поставлено в очередь" : "Роль назначена",
    );
    await refreshManagement();
    onClose();
  }

  return (
    <Dialog
      open
      title={reject ? "Отклонить заявку?" : "Назначить роль"}
      description={`${application.name} · ${application.email}`}
      onClose={pending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            form="application-form"
            variant={reject ? "danger" : "primary"}
            disabled={pending || (!reject && !role)}
          >
            {pending ? "Сохраняем…" : reject ? "Отклонить заявку" : "Назначить роль"}
          </Button>
        </>
      }
    >
      <form id="application-form" onSubmit={submit} className="space-y-4">
        {reject ? (
          <p className="text-sm text-muted-foreground">
            Заявка будет удалена. Пользователь сможет подать новую, пока открыт приём.
          </p>
        ) : (
          <>
            {server && (
              <p className="text-sm text-muted-foreground">
                После назначения роли на почту уйдёт ссылка для установки пароля.
              </p>
            )}
            <Field id="application-role" label="Роль" error={fields.role}>
              <Select
                id="application-role"
                className="w-full"
                value={role}
                onChange={(event) => setRole(event.target.value as Role | "")}
                disabled={pending}
                {...describedBy("application-role", fields.role)}
              >
                <option value="">Выберите роль</option>
                {assignableRoles(actorRole).map((value) => (
                  <option key={value} value={value}>
                    {roleLabel[value]}
                  </option>
                ))}
              </Select>
            </Field>
            {role === "student" && (
              <Field id="application-group" label="Группа" error={fields.group}>
                <Select
                  id="application-group"
                  className="w-full"
                  value={group}
                  onChange={(event) => setGroup(event.target.value)}
                  disabled={pending}
                  {...describedBy("application-group", fields.group)}
                >
                  <option value="">Без группы</option>
                  {groups.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {role === "organizer" &&
              can(actorRole, "system.manage") &&
              (server ? (
                <OrganizerScope value={scope} onChange={setScope} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Назначение факультетов организатору доступно в режиме «Сервер».
                </p>
              ))}
            <Field id="application-faculty" label="Факультет" error={fields.faculty}>
              <FacultySelect
                id="application-faculty"
                value={faculty}
                onChange={(event) => setFaculty(event.target.value)}
                disabled={pending}
                {...describedBy("application-faculty", fields.faculty)}
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-danger"
              disabled={pending}
              onClick={() => {
                reset();
                setReject(true);
              }}
            >
              Отклонить заявку…
            </Button>
          </>
        )}
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
