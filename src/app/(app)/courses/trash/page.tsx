"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { apiErrorInfo, fetcher } from "@/shared/lib/api-client";
import { formatDateTime } from "@/shared/lib/format";
import { Breadcrumbs, Button, Card, CardBody, DataState, EmptyState, PageHeader } from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { coursesApi } from "@/features/courses/api";
import type { DeletedCourse } from "@/shared/types/domain";

// Корзина курсов: удалённые курсы 7 дней можно вернуть (преподаватель — свои, организатор и администратор — все).
// Пока курс здесь, оценки по нему остаются в рейтинге студентов; потом он удаляется окончательно.
export default function CourseTrashPage() {
  const role = useSession((s) => s.role);
  const server = useSession((s) => s.dataSource.source === "server");
  const allowed = can(role, "course.edit");
  const { data, error, isLoading } = useSWR<DeletedCourse[]>(allowed ? "/api/courses/trash" : null, fetcher);
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState<string | null>(null);

  if (!allowed)
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Нет доступа"
        description="Корзина курсов — для преподавателей и управления."
      />
    );

  async function restore(course: DeletedCourse) {
    setBusy(course.id);
    try {
      await coursesApi.restore(course.id);
      await mutate((key) => typeof key === "string" && key.startsWith("/api/courses"));
      toast.success("Курс восстановлен", { description: `${course.code} · ${course.title}` });
    } catch (failure) {
      toast.error("Не удалось восстановить", { description: apiErrorInfo(failure).error });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Корзина курсов"
        subtitle="Удалённые курсы хранятся 7 дней. Пока курс здесь, оценки по нему остаются в рейтинге студентов."
        breadcrumbs={
          <Breadcrumbs items={[{ label: "Курсы", href: "/courses" }, { label: "Корзина курсов" }]} />
        }
      />
      <Card>
        <CardBody>
          <DataState
            loading={isLoading}
            error={error}
            empty={!data?.length}
            emptyTitle="Корзина пуста"
            emptyDescription={server ? undefined : "Корзина курсов — в режиме «Сервер»"}
          >
            <ul className="divide-y">
              {data?.map((course) => (
                <li key={course.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      <span className="mr-1.5 font-mono text-xs text-muted-foreground">{course.code}</span>
                      {course.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      удалил(а) {course.deletedByName} {formatDateTime(course.deletedAt)} · удалится
                      окончательно {formatDateTime(course.purgeAt)}
                      {course.impact.grades + course.impact.submissions > 0 &&
                        ` · оценок: ${course.impact.grades}, работ: ${course.impact.submissions}`}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => restore(course)}
                    disabled={busy !== null}
                  >
                    <RotateCcw size={14} aria-hidden /> {busy === course.id ? "Возвращаем…" : "Восстановить"}
                  </Button>
                </li>
              ))}
            </ul>
          </DataState>
        </CardBody>
      </Card>
    </div>
  );
}
