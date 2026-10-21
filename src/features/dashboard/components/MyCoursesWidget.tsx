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
                className="group -mx-2.5 block rounded-lg p-2.5 transition hover:bg-muted/60"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-9 w-9 rounded-md bg-linear-to-br ${gradientFor(c.id)} flex shrink-0 items-center justify-center text-xs font-semibold text-white`}
                  >
                    {c.code.split("-")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium">{c.title}</div>
                      <span className="shrink-0 text-xs text-muted-foreground">{c.progress ?? 0}%</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.code} · {c.category}
                    </div>
                    <Progress value={c.progress ?? 0} className="mt-1.5" />
                  </div>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </DataState>
    </Widget>
  );
}
