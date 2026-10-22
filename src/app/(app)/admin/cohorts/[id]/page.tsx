"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Pencil, Trash2, UserMinus, UsersRound, BookOpen } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataState,
  Dialog,
  EmptyState,
  PageHeader,
} from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { CohortDialog } from "@/features/admin/components/CohortDialog";
import { MembersDialog } from "@/features/admin/components/MembersDialog";
import { adminApi, refreshManagement } from "@/features/admin/api";
import { courseStatusMeta } from "@/features/admin/labels";
import { FormError, useFormSubmit } from "@/features/admin/use-form-submit";
import type { Cohort, Course, User } from "@/shared/types/domain";

export default function CohortPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const role = useSession((s) => s.role);
  const canManage = can(role, "cohort.manage");
  const { data: cohort, error, isLoading } = useSWR<Cohort>(`/api/cohorts/${id}`, fetcher);
  const { data: users } = useSWR<User[]>("/api/users", fetcher);
  const { data: courses } = useSWR<Course[]>("/api/courses", fetcher);
  const [dialog, setDialog] = useState<"rename" | "members" | "delete" | null>(null);
  // null — без несохранённых правок, показываем курсы группы с сервера
  const [courseIds, setCourseIds] = useState<Set<string> | null>(null);
  const saving = useFormSubmit();

  const students = (users ?? []).filter((u) => u.role === "student");
  const members = students.filter((u) => cohort?.memberIds.includes(u.id));
  const chosen = courseIds ?? new Set(cohort?.courseIds ?? []);

  async function removeMember(user: User) {
    if (!cohort) return;
    const saved = await saving.run(() =>
      adminApi.setMembers(
        cohort.id,
        cohort.memberIds.filter((m) => m !== user.id),
      ),
    );
    if (!saved) return;
    await refreshManagement();
    toast.success(`${user.name} больше не в группе ${cohort.name}`);
  }

  async function saveCourses() {
    if (!cohort) return;
    const saved = await saving.run(() => adminApi.updateCohort(cohort.id, { courseIds: [...chosen] }));
    if (!saved) return;
    await refreshManagement();
    setCourseIds(null);
    toast.success("Курсы группы сохранены", { description: `${saved.courseIds.length} курсов` });
  }

  async function remove() {
    if (!cohort) return;
    // удаление отвечает 204 без тела — успех отличаем по отсутствию ошибки
    let ok = false;
    await saving.run(async () => {
      await adminApi.deleteCohort(cohort.id);
      ok = true;
    });
    if (!ok) return;
    await refreshManagement();
    toast.success(`Группа ${cohort.name} удалена`);
    router.push("/admin/cohorts");
  }

  function toggleCourse(courseId: string) {
    const next = new Set(chosen);
    if (next.has(courseId)) next.delete(courseId);
    else next.add(courseId);
    setCourseIds(next);
  }

  return (
    <DataState loading={isLoading} error={error} empty={!cohort} emptyTitle="Группа не найдена">
      {cohort && (
        <div>
          <PageHeader
            title={`Группа ${cohort.name}`}
            subtitle={[cohort.faculty, `${members.length} студентов`].filter(Boolean).join(" · ")}
            breadcrumbs={
              <Breadcrumbs items={[{ label: "Группы", href: "/admin/cohorts" }, { label: cohort.name }]} />
            }
            actions={
              canManage && (
                <>
                  <Button variant="outline" onClick={() => setDialog("rename")}>
                    <Pencil size={15} aria-hidden /> Переименовать
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setDialog("delete")}
                    disabled={members.length > 0}
                    title={members.length > 0 ? "Удалить можно только пустую группу" : undefined}
                    className="text-danger hover:bg-danger-soft"
                  >
                    <Trash2 size={15} aria-hidden /> Удалить
                  </Button>
                </>
              )
            }
          />
          {dialog === null && <FormError message={saving.error} />}
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Студенты"
                subtitle="Зачислены на все курсы группы"
                icon={<UsersRound size={18} />}
                action={
                  canManage && (
                    <Button size="sm" onClick={() => setDialog("members")}>
                      Изменить состав
                    </Button>
                  )
                }
              />
              <CardBody className="pt-2">
                {members.length === 0 ? (
                  <EmptyState
                    icon={UsersRound}
                    title="В группе пока никого"
                    description="Добавьте студентов — им откроются курсы группы"
                  />
                ) : (
                  <ul className="divide-y">
                    {members.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 py-2.5">
                        <Avatar name={m.name} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{m.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                        </span>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMember(m)}
                            disabled={saving.pending}
                            aria-label={`Убрать ${m.name} из группы`}
                            title="Убрать из группы"
                          >
                            <UserMinus size={16} aria-hidden />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Курсы группы"
                subtitle="Студенты видят только опубликованные курсы"
                icon={<BookOpen size={18} />}
                action={
                  canManage &&
                  courseIds !== null && (
                    <Button size="sm" onClick={saveCourses} disabled={saving.pending}>
                      {saving.pending ? "Сохраняем…" : "Сохранить"}
                    </Button>
                  )
                }
              />
              <CardBody className="pt-2">
                <ul className="space-y-1">
                  {(courses ?? []).map((c) => {
                    const status = courseStatusMeta[c.status ?? "published"];
                    return (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                          <input
                            type="checkbox"
                            checked={chosen.has(c.id)}
                            onChange={() => toggleCourse(c.id)}
                            disabled={!canManage || saving.pending}
                            className="size-4 shrink-0 accent-primary"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{c.title}</span>
                            <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                          </span>
                          {c.status && c.status !== "published" && (
                            <Badge tone={status.tone}>{status.label}</Badge>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          </div>

          {dialog === "rename" && <CohortDialog open onClose={() => setDialog(null)} cohort={cohort} />}
          {dialog === "members" && (
            <MembersDialog open onClose={() => setDialog(null)} cohort={cohort} students={students} />
          )}
          {dialog === "delete" && (
            <Dialog
              open
              onClose={() => setDialog(null)}
              title={`Удалить группу ${cohort.name}?`}
              description="Группа пустая. Курсы останутся, удалится только сама группа."
              footer={
                <>
                  <Button variant="ghost" onClick={() => setDialog(null)}>
                    Отмена
                  </Button>
                  <Button variant="danger" onClick={remove} disabled={saving.pending}>
                    {saving.pending ? "Удаляем…" : "Удалить группу"}
                  </Button>
                </>
              }
            >
              <FormError message={saving.error} />
            </Dialog>
          )}
        </div>
      )}
    </DataState>
  );
}
