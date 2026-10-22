"use client";

import { useState } from "react";
import useSWR from "swr";
import { ShieldAlert } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Card, Avatar, Badge, EmptyState } from "@/shared/ui";
import { ReviewPanel } from "@/features/submissions/components/ReviewPanel";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { formatDateTime } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import type { SubmissionFull } from "@/features/submissions/api";

type Filter = "submitted" | "reviewed" | "all";

export default function SubmissionsPage() {
  const role = useSession((s) => s.role);
  const [filter, setFilter] = useState<Filter>("submitted");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR<{ items: SubmissionFull[] }>(
    `/api/submissions${filter === "all" ? "" : `?status=${filter}`}`,
    fetcher,
  );

  if (!can(role, "submission.review")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Доступ ограничен"
        description="Проверка работ доступна преподавателям и администраторам."
      />
    );
  }

  const items = data?.items ?? [];
  const selected = items.find((s) => s.id === selectedId) ?? null;

  const tabs: { key: Filter; label: string }[] = [
    { key: "submitted", label: "На проверке" },
    { key: "reviewed", label: "Проверенные" },
    { key: "all", label: "Все" },
  ];

  return (
    <div>
      <PageHeader title="Проверка работ" subtitle="Сданные задания по вашим курсам" />

      <div className="mb-5 flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setFilter(t.key);
              setSelectedId(null);
            }}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm transition",
              filter === t.key
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <DataState
            loading={isLoading}
            error={error}
            empty={!items.length}
            emptyTitle="Нет работ"
            emptyDescription="В этой вкладке пока пусто"
          >
            <ul className="divide-y">
              {items.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40",
                      selectedId === s.id && "bg-primary-soft/50",
                    )}
                  >
                    <Avatar name={s.userName} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{s.userName}</span>
                        {s.status === "reviewed" ? (
                          <Badge tone="success">{s.grade} баллов</Badge>
                        ) : (
                          <Badge tone="warning">ждёт</Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{s.assignmentTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.courseTitle} · {formatDateTime(s.submittedAt)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </DataState>
        </Card>

        <div className="h-fit lg:sticky lg:top-24">
          <ReviewPanel
            key={selected ? `${selected.id}:${selected.grade ?? ""}:${selected.feedback ?? ""}` : "none"}
            submission={selected}
          />
        </div>
      </div>
    </div>
  );
}
