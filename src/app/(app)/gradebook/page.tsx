"use client";

import { useState } from "react";
import useSWR from "swr";
import { Download } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Select, Button, Badge } from "@/shared/ui";
import { GradeTable } from "@/features/gradebook/components/GradeTable";
import { exportGradebookCsv } from "@/features/gradebook/export-csv";
import { toast } from "sonner";
import { StudentGrades } from "@/features/gradebook/components/StudentGrades";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import type { Course } from "@/shared/types/domain";

export default function GradebookPage() {
  const role = useSession((s) => s.role);

  // Студент видит только свои оценки
  if (!can(role, "analytics.view")) {
    return (
      <div>
        <PageHeader title="Мои оценки" subtitle="Ваши результаты по курсам" />
        <StudentGrades />
      </div>
    );
  }

  return <TeacherGradebook editable={can(role, "grade.edit")} />;
}

function TeacherGradebook({ editable }: { editable: boolean }) {
  const { data: courses, isLoading, error } = useSWR<Course[]>("/api/courses", fetcher);
  const [courseId, setCourseId] = useState<string>("");
  const selected = courseId || courses?.[0]?.id || "";

  return (
    <div>
      <PageHeader
        title="Журнал оценок"
        subtitle="Оценки студентов по курсу"
        actions={
          <>
            {editable && <Badge tone="info">редактирование доступно</Badge>}
            <Button
              variant="outline"
              disabled={!selected}
              onClick={() =>
                exportGradebookCsv(selected, courses?.find((c) => c.id === selected)?.code ?? selected).catch(
                  () => toast.error("Не удалось выгрузить журнал. Обновите страницу — обычно это помогает"),
                )
              }
            >
              <Download size={16} aria-hidden />
              Экспорт CSV
            </Button>
          </>
        }
      />
      <DataState loading={isLoading} error={error} empty={!courses?.length}>
        <div className="mb-5 flex items-center gap-3">
          <label className="text-sm text-muted-foreground">Курс:</label>
          <Select value={selected} onChange={(e) => setCourseId(e.target.value)} className="min-w-[320px]">
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.title}
              </option>
            ))}
          </Select>
        </div>
        {selected && <GradeTable courseId={selected} editable={editable} />}
      </DataState>
    </div>
  );
}
