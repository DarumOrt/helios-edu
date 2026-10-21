"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { Bell, AlertTriangle, Award, Megaphone, MessageSquare, type LucideIcon } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Button } from "@/shared/ui";
import { formatDateTime } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
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

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useSWR<Notification[]>("/api/notifications", fetcher, { refreshInterval: 30000 });
  const unread = (data ?? []).filter((n) => !n.read).length;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label="Уведомления"
        className="relative"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 font-mono text-xs leading-none font-medium text-white">
            {unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute top-11 right-0 z-30 w-80 origin-top-right animate-pop-in overflow-hidden rounded-xl border bg-card shadow-elevate">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Уведомления</span>
            {unread > 0 && <span className="text-xs text-muted-foreground">{unread} новых</span>}
          </div>
          <ul className="max-h-96 scrollbar-thin overflow-y-auto">
            {(data ?? []).map((n) => {
              const Icon = iconByType[n.type];
              return (
                <li
                  key={n.id}
                  className={cn(
                    "border-b px-4 py-3 transition last:border-b-0 hover:bg-muted/50",
                    !n.read && "bg-primary-soft/40",
                  )}
                >
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        toneByType[n.type],
                      )}
                    >
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{n.title}</div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
            {!data?.length && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Пусто</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
