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
  deadline: "text-warning",
  grade: "text-success",
  announcement: "text-primary",
  forum: "text-muted-foreground",
};

export function NotificationsWidget() {
  const { data, error, isLoading } = useSWR<Notification[]>("/api/notifications", fetcher, {
    refreshInterval: 30000,
  });

  return (
    <Widget title="Уведомления" icon={Bell}>
      <DataState loading={isLoading} error={error} empty={!data?.length}>
        <ul className="space-y-2.5">
          {data?.slice(0, 5).map((n) => {
            const Icon = iconByType[n.type];
            return (
              <li key={n.id} className="flex gap-3 py-1">
                <Icon size={16} className={`mt-0.5 shrink-0 ${toneByType[n.type]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="truncate text-sm font-medium">{n.title}</div>
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{n.body}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </DataState>
    </Widget>
  );
}
