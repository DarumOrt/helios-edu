"use client";

import useSWR from "swr";
import { Plus } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Button } from "@/shared/ui";
import { ProgramCard } from "@/features/programs/components/ProgramCard";
import { RoleGate } from "@/shared/auth/RoleGate";
import type { Program } from "@/shared/types/domain";

export default function ProgramsPage() {
  const { data, error, isLoading } = useSWR<Program[]>("/api/programs", fetcher);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Программы обучения"
        subtitle="Наборы курсов с правилами прохождения"
        actions={
          <RoleGate roles={["admin", "organizer"]}>
            <Button>
              <Plus size={16} />
              Создать программу
            </Button>
          </RoleGate>
        }
      />
      <DataState loading={isLoading} error={error} empty={!data?.length}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.map((p) => <ProgramCard key={p.id} program={p} />)}
        </div>
      </DataState>
    </div>
  );
}
