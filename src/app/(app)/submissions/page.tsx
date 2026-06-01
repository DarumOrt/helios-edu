"use client";

import { useState } from "react";
import useSWR from "swr";
import { ClipboardCheck, ShieldAlert } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Card, Avatar, Badge, EmptyState } from "@/shared/ui";
import { ReviewPanel } from "@/features/submissions/components/ReviewPanel";
import { useSessionStore } from "@/stores/session-store";
import { formatDateTime } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import type { SubmissionFull } from "@/features/submissions/api";

type Filter = "submitted" | "reviewed" | "all";

export default function SubmissionsPage() {
  const role = useSessionStore((s) => s.role);
  const [filter, setFilter] = useState<Filter>("submitted");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR<{ items: SubmissionFull[] }>(
    `/api/submissions${filter === "all" ? "" : `?status=${filter}`}`,
    fetcher
  );

  if (role !== "tutor" && role !== "admin") {
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
    <div className="animate-fade-in">
      <PageHeader title="Проверка работ" subtitle="Сданные задания группы М1217" />

      <div className="flex gap-1 border-b mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setFilter(t.key);
              setSelectedId(null);
            }}
            className={cn(
              "px-4 py-2 text-sm border-b-2 -mb-px transition",
              filter === t.key
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                      "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition",
                      selectedId === s.id && "bg-primary-soft/50"
                    )}
                  >
                    <Avatar name={s.userName} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{s.userName}</span>
                        {s.status === "reviewed" ? (
                          <Badge tone="success">{s.grade} баллов</Badge>
                        ) : (
                          <Badge tone="warning">ждёт</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{s.assignmentTitle}</div>
                      <div className="text-[11px] text-muted-foreground/70">
                        {s.courseTitle} · {formatDateTime(s.submittedAt)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </DataState>
        </Card>

        <div className="lg:sticky lg:top-24 h-fit">
          <ReviewPanel submission={selected} />
        </div>
      </div>
    </div>
  );
}
