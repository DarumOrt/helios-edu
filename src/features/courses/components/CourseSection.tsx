"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  CheckCircle2,
  FileText,
  FileDown,
  MessagesSquare,
  ClipboardCheck,
  Video,
  Presentation,
  Activity as ActivityIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/shared/ui";
import { formatDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import type { Section, ActivityType } from "@/shared/types/domain";

const iconByType: Record<ActivityType, LucideIcon> = {
  quiz: ClipboardCheck,
  assignment: FileText,
  file: FileDown,
  forum: MessagesSquare,
  page: FileText,
  video: Video,
  pdf: FileText,
  presentation: Presentation,
};

const labelByType: Record<ActivityType, string> = {
  quiz: "Тест",
  assignment: "Задание",
  file: "Файл",
  forum: "Форум",
  page: "Страница",
  video: "Видеолекция",
  pdf: "Конспект (PDF)",
  presentation: "Презентация",
};

// активности с трекингом просмотра
const TRACKED: ActivityType[] = ["video", "pdf", "presentation"];

export function CourseSection({ section, courseId }: { section: Section; courseId: string }) {
  const [open, setOpen] = useState(true);
  const total = section.activities.length;
  const done = section.activities.filter((a) => a.completed).length;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-muted/40"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-xs font-semibold text-primary">
            {section.order}
          </div>
          <div>
            <div className="font-semibold">{section.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {done} из {total} активностей завершено
            </div>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={cn("text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul className="divide-y border-t">
          {section.activities.map((a) => {
            const Icon = iconByType[a.type];
            const href =
              a.type === "quiz"
                ? `/courses/${courseId}/quiz/${a.id}`
                : a.type === "assignment"
                  ? `/courses/${courseId}/assignment/${a.id}`
                  : a.type === "video"
                    ? `/courses/${courseId}/video/${a.id}`
                    : a.type === "pdf" || a.type === "presentation"
                      ? `/courses/${courseId}/document/${a.id}`
                      : `/courses/${courseId}#a-${a.id}`;
            const tracked = TRACKED.includes(a.type);
            return (
              <li key={a.id}>
                <Link
                  href={href}
                  className="group flex items-center justify-between px-5 py-3 transition hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        a.completed ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {labelByType[a.type]}
                        {a.durationMin ? ` · ${a.durationMin} мин` : ""}
                        {a.due ? ` · до ${formatDate(a.due)}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {tracked && (
                      <span className="hidden items-center gap-1 text-[10px] text-primary/70 sm:flex">
                        <ActivityIcon size={11} />
                        отслеживается
                      </span>
                    )}
                    {a.completed ? (
                      <Badge tone="success">
                        <CheckCircle2 size={11} />
                        Завершено
                      </Badge>
                    ) : a.due ? (
                      <Badge tone="warning">К сроку</Badge>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
