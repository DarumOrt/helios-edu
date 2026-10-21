"use client";

import useSWR from "swr";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { CourseCover, DataState, Progress } from "@/shared/ui";
import { Widget } from "./Widget";
import type { Course } from "@/shared/types/domain";

export function MyCoursesWidget() {
  const { data, error, isLoading } = useSWR<Course[]>("/api/courses", fetcher);

  return (
    <Widget title="Мои курсы" icon={BookOpen}>
      <DataState loading={isLoading} error={error} empty={!data?.length}>
        <ul className="space-y-3">
          {data?.slice(0, 4).map((c) => (
            <li key={c.id}>
              <Link
                href={`/courses/${c.id}`}
                className="group -mx-2.5 block rounded-md p-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="flex items-center gap-3">
                  <CourseCover course={c} variant="thumb" className="h-11 w-14 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium">{c.title}</div>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                        {c.progress ?? 0}%
                      </span>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
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
