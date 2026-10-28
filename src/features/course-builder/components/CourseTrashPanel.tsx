"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button, Card, CardBody, DataState } from "@/shared/ui";
import { apiErrorInfo, fetcher } from "@/shared/lib/api-client";
import { formatDateTime } from "@/shared/lib/format";
import { activityLabel } from "@/shared/lib/activity-meta";
import { useSession } from "@/shared/auth/session";
import type { Course, CourseTrashItem } from "@/shared/types/domain";
import { builderApi } from "../api";

/** Корзина курса: удалённые модули и материалы — 7 дней, потом окончательно (как «Корзина» Moodle). */
export function CourseTrashPanel({ course }: { course: Course }) {
  const key = `/api/courses/${course.id}/trash`;
  const { data, error, isLoading } = useSWR<CourseTrashItem[]>(key, fetcher);
  const server = useSession((s) => s.dataSource.source === "server");
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState<string | null>(null);

  async function restore(item: CourseTrashItem) {
    setBusy(item.id);
    try {
      await builderApi.restoreTrashItem(course.id, item.id);
      await Promise.all([mutate(key), mutate(`/api/courses/${course.id}`)]);
      toast.success(item.kind === "section" ? "Модуль восстановлен" : "Материал восстановлен", {
        description: item.title,
      });
    } catch (failure) {
      toast.error("Не удалось восстановить", { description: apiErrorInfo(failure).error });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardBody>
        <p className="mb-4 text-sm text-muted-foreground">
          {server
            ? "Удалённые модули и материалы хранятся здесь 7 дней — их можно вернуть на прежнее место вместе с вопросами тестов."
            : "Корзина курса — в режиме «Сервер». В демо материалы удаляются сразу."}
        </p>
        <DataState
          loading={isLoading}
          error={error}
          empty={!data?.length}
          emptyTitle="Корзина пуста"
          emptyDescription={server ? "Удалённые модули и материалы появятся здесь" : undefined}
        >
          <ul className="divide-y">
            {data?.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                <Trash2 size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.kind === "section"
                      ? "Модуль"
                      : `${activityLabel[item.type ?? "page"]} · ${item.sectionTitle}`}{" "}
                    · удалил(а) {item.deletedByName} {formatDateTime(item.deletedAt)} · удалится{" "}
                    {formatDateTime(item.purgeAt)}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => restore(item)} disabled={busy !== null}>
                  <RotateCcw size={14} aria-hidden /> {busy === item.id ? "Возвращаем…" : "Восстановить"}
                </Button>
              </li>
            ))}
          </ul>
        </DataState>
      </CardBody>
    </Card>
  );
}
