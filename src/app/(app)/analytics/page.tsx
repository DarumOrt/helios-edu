"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/lib/api-client";
import type { Course } from "@/shared/types/domain";
import { ShieldAlert } from "lucide-react";
import { PageHeader, Select, EmptyState } from "@/shared/ui";
import { CourseStatsPanel } from "@/features/analytics/components/CourseStatsPanel";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";

export default function AnalyticsPage() {
  const role = useSession((s) => s.role);
  // курсы, которые видит пользователь (преподавателю — свои); по умолчанию первый
  const { data: courses } = useSWR<Course[]>(can(role, "analytics.view") ? "/api/courses" : null, fetcher);
  const [picked, setPicked] = useState("");
  const courseId = picked || courses?.[0]?.id || "";

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
    <div>
      <PageHeader
        title="Аналитика групп"
        subtitle="Как группы изучают материалы курса"
        actions={
          <Select aria-label="Курс" value={courseId} onChange={(e) => setPicked(e.target.value)}>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        }
      />
      {courseId && <CourseStatsPanel courseId={courseId} />}
    </div>
  );
}
