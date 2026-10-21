"use client";

import useSWR from "swr";
import { Bell, AlertTriangle, Award, Megaphone, MessageSquare, type LucideIcon } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { DataState } from "@/shared/ui";
import { Widget } from "./Widget";
import { formatDateTime } from "@/shared/lib/format";
import type { Notification } from "@/shared/types/domain";

const iconByType: Record<Notification["type"], LucideIcon> = {
  deadline: AlertTriangle,
  grade: Award,
  announcement: Megaphone,
  forum: MessageSquare,
};

const toneByType: Record<Notification["type"], string> = {
  deadline: "bg-warning-soft text-warning",
  grade: "bg-success-soft text-success",
  announcement: "bg-primary-soft text-primary",
  forum: "bg-muted text-muted-foreground",
};

export function NotificationsWidget() {
  const { data, error, isLoading } = useSWR<Notification[]>("/api/notifications", fetcher, {
    refreshInterval: 30000,
  });

  return (
    <Widget title="Уведомления" subtitle="Real-time, обновление каждые 30 сек" icon={Bell}>
      <DataState loading={isLoading} error={error} empty={!data?.length}>
        <ul className="space-y-2.5">
          {data?.slice(0, 5).map((n) => {
            const Icon = iconByType[n.type];
            return (
              <li key={n.id} className="-mx-2 flex gap-3 rounded-md p-2 transition hover:bg-muted/60">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${toneByType[n.type]}`}
                >
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="truncate text-sm font-medium">{n.title}</div>
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{n.body}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {formatDateTime(n.createdAt)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </DataState>
    </Widget>
  );
}
