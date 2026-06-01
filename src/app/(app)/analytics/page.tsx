"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { PageHeader, Select, EmptyState } from "@/shared/ui";
import { CourseStatsPanel } from "@/features/analytics/components/CourseStatsPanel";
import { useSessionStore } from "@/stores/session-store";
import { can } from "@/shared/auth/permissions";

// курсы с включёнными метриками
const TRACKED = [{ id: "c-matan", title: "Математический анализ" }];

export default function AnalyticsPage() {
  const role = useSessionStore((s) => s.role);
  const [courseId, setCourseId] = useState("c-matan");

  if (!can(role, "analytics.view")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Доступ ограничен"
        description="Аналитика доступна преподавателям, организаторам и администраторам."
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Аналитика групп"
        subtitle="Изучение материалов группой М1217 по курсам"
        actions={
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {TRACKED.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        }
      />
      <CourseStatsPanel courseId={courseId} />
    </div>
  );
}
