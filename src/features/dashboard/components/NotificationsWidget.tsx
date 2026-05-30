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
              <li key={n.id} className="flex gap-3 p-2 -mx-2 rounded-md hover:bg-muted/60 transition">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${toneByType[n.type]}`}>
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{n.body}</div>
                  <div className="text-[11px] text-muted-foreground/70 mt-0.5">{formatDateTime(n.createdAt)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </DataState>
    </Widget>
  );
}
