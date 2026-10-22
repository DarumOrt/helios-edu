"use client";

import { useState } from "react";
import useSWR from "swr";
import { Trophy, Info, Radar } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, Select } from "@/shared/ui";
import { Leaderboard } from "@/features/hub/components/Leaderboard";
import { GroupMonitor } from "@/features/hub/components/GroupMonitor";
import { useSession } from "@/shared/auth/session";
import type { Course } from "@/shared/types/domain";

const TRACKED = ["c-matan"];

export default function HubPage() {
  const role = useSession((s) => s.role);
  const isTeacher = role !== "student";
  const { data: courses } = useSWR<Course[]>("/api/courses", fetcher);
  const tracked = (courses ?? []).filter((c) => TRACKED.includes(c.id));
  const [courseId, setCourseId] = useState("c-matan");

  return (
    <div>
      <PageHeader
        title={isTeacher ? "Мониторинг группы М1217" : "Хаб группы М1217"}
        subtitle={
          isTeacher
            ? "Кто как изучает материалы — фокус на отстающих"
            : "Рейтинг вовлечённости по изучению материалов и тестам"
        }
        actions={
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {tracked.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        }
      />

      {isTeacher ? (
        <>
          <p className="mb-5 flex items-start gap-2 text-sm text-muted-foreground">
            <Radar size={16} className="mt-0.5 shrink-0" aria-hidden />
            Список отсортирован от отстающих к лучшим, чтобы быстро увидеть, кому нужна помощь.
          </p>
          <GroupMonitor courseId={courseId} />
        </>
      ) : (
        <>
          <p className="mb-5 flex items-start gap-2 text-sm text-muted-foreground">
            <Trophy size={16} className="mt-0.5 shrink-0" aria-hidden />
            Балл = 50% покрытие материалов + 30% результаты тестов + 20% завершённость. Перемотка и фоновые
            вкладки не засчитываются.
          </p>
          <Leaderboard courseId={courseId} />
          <div className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Метрики отражают вовлечённость (контакт с материалом), а не усвоение. Отображение одногруппникам
              — по согласию; преподавателю доступна детальная статистика.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
