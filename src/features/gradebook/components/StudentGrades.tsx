"use client";

import useSWR from "swr";
import { GraduationCap } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Card, CardBody, DataState, Badge, Progress } from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import type { StudentCourseGrades } from "../api";

function tone(grade: number | null, max: number): "success" | "info" | "warning" | "danger" | "neutral" {
  if (grade == null) return "neutral";
  const p = grade / max;
  if (p >= 0.85) return "success";
  if (p >= 0.7) return "info";
  if (p >= 0.5) return "warning";
  return "danger";
}

export function StudentGrades() {
  const user = useSession((s) => s.user);
  const { data, error, isLoading } = useSWR<{ courses: StudentCourseGrades[] }>(
    `/api/gradebook/me?userId=${user.id}`,
    fetcher,
  );

  const courses = data?.courses ?? [];
  const avg = courses.length ? Math.round(courses.reduce((s, c) => s + c.total, 0) / courses.length) : 0;

  return (
    <DataState
      loading={isLoading}
      error={error}
      empty={!courses.length}
      emptyTitle="Оценок пока нет"
      emptyDescription="Здесь появятся ваши оценки по курсам"
    >
      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4">
          <div className="text-sm text-muted-foreground">Средний итог по курсам</div>
          <div className="font-mono text-2xl font-semibold tabular-nums">
            {avg.toFixed(1)}
            <span className="text-base font-normal text-muted-foreground"> / 100</span>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {courses.map((c) => (
          <Card key={c.courseId} className="overflow-hidden">
            <CardBody>
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap size={16} className="text-muted-foreground" />
                  <div>
                    <div className="text-sm font-semibold">{c.courseTitle}</div>
                    <div className="font-mono text-xs text-muted-foreground">{c.courseCode}</div>
                  </div>
                </div>
                <Badge tone={c.total >= 80 ? "success" : c.total >= 50 ? "info" : "warning"}>
                  итог {c.total.toFixed(1)}
                </Badge>
              </div>
              <ul className="space-y-2">
                {c.items.map((it) => (
                  <li key={it.itemId} className="flex items-center gap-3">
                    <span className="flex-1 truncate text-sm">{it.itemTitle}</span>
                    {it.grade == null ? (
                      <span className="text-xs text-muted-foreground">не оценено</span>
                    ) : (
                      <>
                        <Progress
                          value={(it.grade / it.max) * 100}
                          tone={it.grade / it.max >= 0.7 ? "success" : "primary"}
                          className="w-20"
                        />
                        <Badge tone={tone(it.grade, it.max)}>
                          {it.grade}/{it.max}
                        </Badge>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>
    </DataState>
  );
}
