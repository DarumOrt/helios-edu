"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Button } from "@/shared/ui";
import { ProgramCard } from "@/features/programs/components/ProgramCard";
import { ProgramDialog } from "@/features/programs/components/ProgramDialog";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import type { Course, Program } from "@/shared/types/domain";

export default function ProgramsPage() {
  const { data, error, isLoading } = useSWR<Program[]>("/api/programs", fetcher);
  const role = useSession((s) => s.role);
  const canManage = can(role, "program.manage");
  const { data: courses } = useSWR<Course[]>(canManage ? "/api/courses" : null, fetcher);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Программы обучения"
        subtitle="Наборы курсов с правилами прохождения"
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden />
              Создать программу
            </Button>
          )
        }
      />
      <DataState loading={isLoading} error={error} empty={!data?.length}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
        </div>
      </DataState>
      {creating && <ProgramDialog courses={courses ?? []} onClose={() => setCreating(false)} />}
    </div>
  );
}
