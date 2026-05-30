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
};

const labelByType: Record<ActivityType, string> = {
  quiz: "Тест",
  assignment: "Задание",
  file: "Файл",
  forum: "Форум",
  page: "Страница",
};

export function CourseSection({ section, courseId }: { section: Section; courseId: string }) {
  const [open, setOpen] = useState(true);
  const total = section.activities.length;
  const done = section.activities.filter((a) => a.completed).length;

  return (
    <div className="bg-card border rounded-xl shadow-soft overflow-hidden">
      <button
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted/40 transition"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-soft text-primary text-xs font-semibold flex items-center justify-center">
            {section.order}
          </div>
          <div>
            <div className="font-semibold">{section.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
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
        <ul className="border-t divide-y">
          {section.activities.map((a) => {
            const Icon = iconByType[a.type];
            const href =
              a.type === "quiz"
                ? `/courses/${courseId}/quiz/${a.id}`
                : a.type === "assignment"
                ? `/courses/${courseId}/assignment/${a.id}`
                : `/courses/${courseId}#a-${a.id}`;
            return (
              <li key={a.id}>
                <Link
                  href={href}
                  className="px-5 py-3 flex items-center justify-between hover:bg-muted/40 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                        a.completed
                          ? "bg-success-soft text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {labelByType[a.type]}
                        {a.durationMin ? ` · ${a.durationMin} мин` : ""}
                        {a.due ? ` · до ${formatDate(a.due)}` : ""}
                      </div>
                    </div>
                  </div>
                  {a.completed ? (
                    <Badge tone="success">
                      <CheckCircle2 size={11} />
                      Завершено
                    </Badge>
                  ) : a.due ? (
                    <Badge tone="warning">К сроку</Badge>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
