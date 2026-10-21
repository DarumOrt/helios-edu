"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Search } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Button, Input } from "@/shared/ui";
import { CourseCard } from "@/features/courses/components/CourseCard";
import { RoleGate } from "@/shared/auth/RoleGate";
import type { Course } from "@/shared/types/domain";

export default function CoursesPage() {
  const { data, error, isLoading } = useSWR<Course[]>("/api/courses", fetcher);
  const [q, setQ] = useState("");

  const filtered = (data ?? []).filter(
    (c) =>
      c.title.toLowerCase().includes(q.toLowerCase()) ||
      c.code.toLowerCase().includes(q.toLowerCase()) ||
      c.category.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Мои курсы"
        subtitle="Все доступные вам курсы"
        actions={
          <RoleGate roles={["admin", "organizer", "tutor"]}>
            <Button>
              <Plus size={16} />
              Создать курс
            </Button>
          </RoleGate>
        }
      />

      <div className="relative mb-5 max-w-md">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию, коду, категории…"
          className="pl-9"
        />
      </div>

      <DataState
        loading={isLoading}
        error={error}
        empty={!filtered.length}
        emptyTitle={q ? "Ничего не найдено" : "Курсов пока нет"}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      </DataState>
    </div>
  );
}
