"use client";

import useSWR from "swr";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { DataState, Progress } from "@/shared/ui";
import { Widget } from "./Widget";
import { gradientFor } from "@/shared/lib/utils";
import type { Course } from "@/shared/types/domain";

export function MyCoursesWidget() {
  const { data, error, isLoading } = useSWR<Course[]>("/api/courses", fetcher);

  return (
    <Widget title="Мои курсы" subtitle="Активные записи" icon={BookOpen}>
      <DataState loading={isLoading} error={error} empty={!data?.length}>
        <ul className="space-y-3">
          {data?.slice(0, 4).map((c) => (
            <li key={c.id}>
              <Link
                href={`/courses/${c.id}`}
                className="block group rounded-lg p-2.5 -mx-2.5 hover:bg-muted/60 transition"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-md bg-gradient-to-br ${gradientFor(c.id)} text-white text-xs font-semibold flex items-center justify-center shrink-0`}
                  >
                    {c.code.split("-")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{c.title}</div>
                      <span className="text-xs text-muted-foreground shrink-0">{c.progress ?? 0}%</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{c.code} · {c.category}</div>
                    <Progress value={c.progress ?? 0} className="mt-1.5" />
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </DataState>
    </Widget>
  );
}
