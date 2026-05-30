"use client";

import { useState } from "react";
import useSWR from "swr";
import { Download } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Select, Button } from "@/shared/ui";
import { GradeTable } from "@/features/gradebook/components/GradeTable";
import type { Course } from "@/shared/types/domain";

export default function GradebookPage() {
  const { data: courses, isLoading, error } = useSWR<Course[]>("/api/courses", fetcher);
  const [courseId, setCourseId] = useState<string>("");
  const selected = courseId || courses?.[0]?.id || "";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Журнал оценок"
        subtitle="Сводка по выбранному курсу"
        actions={
          <Button variant="outline">
            <Download size={16} />
            Экспорт CSV
          </Button>
        }
      />
      <DataState loading={isLoading} error={error} empty={!courses?.length}>
        <div className="flex items-center gap-3 mb-5">
          <label className="text-sm text-muted-foreground">Курс:</label>
          <Select value={selected} onChange={(e) => setCourseId(e.target.value)} className="min-w-[320px]">
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.title}
              </option>
            ))}
          </Select>
        </div>
        {selected && <GradeTable courseId={selected} />}
      </DataState>
    </div>
  );
}
