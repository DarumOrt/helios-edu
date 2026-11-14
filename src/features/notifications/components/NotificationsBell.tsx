"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  Bell,
  AlertTriangle,
  Award,
  Megaphone,
  MessageSquare,
  CheckCheck,
  Search,
  type LucideIcon,
} from "lucide-react";
import { api, apiErrorInfo, fetcher } from "@/shared/lib/api-client";
import { Badge, Button, DataState, Dialog, Input, Select } from "@/shared/ui";
import { FormError } from "@/shared/ui/form-submit";
import { formatDateTime } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import type { Notification } from "@/shared/types/domain";
import { POLL_FEED } from "@/shared/lib/polling";
import { filterNotifications, groupNotifications, type NotificationFilters } from "../filters";

const iconByType: Record<Notification["type"], LucideIcon> = {
  deadline: AlertTriangle,
  grade: Award,
  announcement: Megaphone,
  forum: MessageSquare,
};
const typeLabel = {
  deadline: "Сроки сдачи",
  grade: "Оценки",
  announcement: "Объявления",
  forum: "Обсуждения",
};
const toneByType = {
  deadline: "bg-warning-soft text-warning",
  grade: "bg-success-soft text-success",
  announcement: "bg-primary-soft text-primary",
  forum: "bg-muted text-muted-foreground",
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<NotificationFilters>({ unread: false, course: "", type: "", q: "" });
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<Notification[]>("/api/notifications", fetcher, {
    refreshInterval: POLL_FEED,
  });
  const all = data ?? [];
  const unread = all.filter((n) => !n.read).length;
  const options = groupNotifications(all).sort((a, b) => a.title.localeCompare(b.title, "ru"));
  const filtered = filterNotifications(all, filters);
  const groups = groupNotifications(filtered);
  const visibleUnread = filtered.filter((n) => !n.read);
  const set = (patch: Partial<NotificationFilters>) => setFilters((value) => ({ ...value, ...patch }));

  async function mark(ids: string[]) {
    setPending(true);
    setActionError("");
    try {
      for (let offset = 0; offset < ids.length; offset += 200)
        await api.post("/api/notifications/read", { ids: ids.slice(offset, offset + 200) });
      const changed = new Set(ids);
      await mutate((list) => list?.map((n) => (changed.has(n.id) ? { ...n, read: true } : n)), {
        revalidate: false,
      });
      return true;
    } catch (failure) {
      setActionError(apiErrorInfo(failure).error ?? "Не удалось отметить уведомления. Попробуйте ещё раз.");
      await mutate();
      return false;
    } finally {
      setPending(false);
    }
  }
  async function openNotification(n: Notification) {
    if (!n.read && !(await mark([n.id]))) return;
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={`Уведомления${unread ? `, непрочитанных: ${unread}` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative"
      >
        <Bell size={18} aria-hidden />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-danger-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Уведомления"
        description={
          unread
            ? `Непрочитанных: ${unread}. Объявления, оценки и сроки — по вашим курсам.`
            : "Все сообщения прочитаны. Новые появятся здесь."
        }
        className="max-w-2xl"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Показано: {filtered.length} из {all.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !visibleUnread.length}
              onClick={() => mark(visibleUnread.map((n) => n.id))}
            >
              <CheckCheck size={16} aria-hidden />
              {pending ? "Сохраняем…" : "Прочитать показанные"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Прочитанность">
            <Button
              variant={!filters.unread ? "primary" : "ghost"}
              size="sm"
              className="flex-1"
              aria-pressed={!filters.unread}
              onClick={() => set({ unread: false })}
            >
              Все
            </Button>
            <Button
              variant={filters.unread ? "primary" : "ghost"}
              size="sm"
              className="flex-1"
              aria-pressed={filters.unread}
              onClick={() => set({ unread: true })}
            >
              Непрочитанные ({unread})
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              aria-label="Курс уведомления"
              value={filters.course}
              onChange={(e) => set({ course: e.target.value })}
              className="w-full min-w-0"
            >
              <option value="">Все курсы и личные</option>
              {options.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} ({g.items.filter((n) => !n.read).length})
                </option>
              ))}
            </Select>
            <Select
              aria-label="Тип уведомления"
              value={filters.type}
              onChange={(e) => set({ type: e.target.value })}
              className="w-full"
            >
              <option value="">Все типы сообщений</option>
              {Object.entries(typeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative">
            <Search size={16} aria-hidden className="absolute top-3 left-3 text-muted-foreground" />
            <Input
              aria-label="Поиск в уведомлениях"
              placeholder="Найти сообщение…"
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              className="pl-9"
            />
          </div>
          <FormError message={actionError} />
          <DataState
            loading={isLoading}
            error={error}
            empty={!filtered.length}
            emptyTitle={all.length ? "Подходящих уведомлений нет" : "Уведомлений пока нет"}
            emptyDescription={
              all.length
                ? "Измените фильтры или поисковый запрос."
                : "Сообщим о новых объявлениях, оценках и сроках сдачи."
            }
          >
            <div className="space-y-4">
              {groups.map((group) => (
                <section
                  key={group.id}
                  className="overflow-hidden rounded-xl border"
                  aria-label={group.title}
                >
                  <div className="flex items-center justify-between gap-3 bg-muted/60 px-4 py-3">
                    <h3 className="min-w-0 text-sm font-semibold break-words">{group.title}</h3>
                    <Badge className="shrink-0">{group.items.length}</Badge>
                  </div>
                  <ul className="divide-y">
                    {group.items.map((n) => {
                      const Icon = iconByType[n.type];
                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => openNotification(n)}
                            className={cn(
                              "flex w-full gap-3 px-4 py-4 text-left transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden disabled:opacity-60",
                              !n.read && "bg-primary-soft/30",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                toneByType[n.type],
                              )}
                            >
                              <Icon size={17} aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                <span>{typeLabel[n.type]}</span>
                                {!n.read && <span className="font-medium text-primary">Новое</span>}
                              </span>
                              <span className="block text-sm font-medium break-words">{n.title}</span>
                              <span className="mt-1 block text-sm whitespace-pre-line text-muted-foreground">
                                {n.body}
                              </span>
                              <time
                                dateTime={n.createdAt}
                                className="mt-2 block text-xs text-muted-foreground"
                              >
                                {formatDateTime(n.createdAt)}
                              </time>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </DataState>
        </div>
      </Dialog>
    </>
  );
}
