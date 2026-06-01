"use client";

import { useState } from "react";
import useSWR from "swr";
import { Trophy, Info, Radar } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, Select, Card, CardBody } from "@/shared/ui";
import { Leaderboard } from "@/features/hub/components/Leaderboard";
import { GroupMonitor } from "@/features/hub/components/GroupMonitor";
import { useSessionStore } from "@/stores/session-store";
import type { Course } from "@/shared/types/domain";

const TRACKED = ["c-matan"];

export default function HubPage() {
  const role = useSessionStore((s) => s.role);
  const isTeacher = role !== "student";
  const { data: courses } = useSWR<Course[]>("/api/courses", fetcher);
  const tracked = (courses ?? []).filter((c) => TRACKED.includes(c.id));
  const [courseId, setCourseId] = useState("c-matan");

  return (
    <div className="animate-fade-in">
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
          <Card className="mb-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardBody className="flex items-center gap-4 py-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center shrink-0">
                <Radar size={22} />
              </div>
              <div>
                <div className="font-semibold">Режим мониторинга</div>
                <div className="text-sm text-muted-foreground">
                  Список отсортирован от отстающих к лучшим, чтобы быстро увидеть, кому нужна помощь.
                </div>
              </div>
            </CardBody>
          </Card>
          <GroupMonitor courseId={courseId} />
        </>
      ) : (
        <>
          <Card className="mb-5 bg-gradient-to-r from-primary-soft to-violet-50 border-primary/20">
            <CardBody className="flex items-center gap-4 py-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center shrink-0">
                <Trophy size={22} />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Соревнование недели</div>
                <div className="text-sm text-muted-foreground">
                  Балл = 50% покрытие материалов + 30% результаты тестов + 20% завершённость.
                  Перемотка и фоновые вкладки не засчитываются.
                </div>
              </div>
            </CardBody>
          </Card>
          <Leaderboard courseId={courseId} />
          <div className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
            <Info size={14} className="shrink-0 mt-0.5" />
            <p>
              Метрики отражают вовлечённость (контакт с материалом), а не усвоение. Отображение
              одногруппникам — по согласию; преподавателю доступна детальная статистика.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
