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
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-medium flex items-center justify-center">
            {unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-card border rounded-xl shadow-elevate z-30 overflow-hidden animate-fade-in">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">Уведомления</span>
            {unread > 0 && (
              <span className="text-[11px] text-muted-foreground">{unread} новых</span>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto scrollbar-thin">
            {(data ?? []).map((n) => {
              const Icon = iconByType[n.type];
              return (
                <li
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 transition",
                    !n.read && "bg-primary-soft/40"
                  )}
                >
                  <div className="flex gap-3">
                    <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", toneByType[n.type])}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{n.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                      <div className="text-[10px] text-muted-foreground/70 mt-1">{formatDateTime(n.createdAt)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
            {!data?.length && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Пусто</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
