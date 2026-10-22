"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Search } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { PageHeader, DataState, Button, Input } from "@/shared/ui";
import { CourseCard } from "@/features/courses/components/CourseCard";
import { CourseDialog } from "@/features/admin/components/CourseDialog";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import type { Course, User } from "@/shared/types/domain";

export default function CoursesPage() {
  const { data, error, isLoading } = useSWR<Course[]>("/api/courses", fetcher);
  const [q, setQ] = useState("");
  const role = useSession((s) => s.role);
  const canCreate = can(role, "course.create");
  const [creating, setCreating] = useState(false);
  // список преподавателей нужен только тем, кто создаёт курсы
  const { data: users } = useSWR<User[]>(canCreate ? "/api/users" : null, fetcher);

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
          canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden />
              Создать курс
            </Button>
          )
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
      {creating && (
        <CourseDialog
          open
          onClose={() => setCreating(false)}
          tutors={(users ?? []).filter((u) => u.role === "tutor" && u.status !== "blocked")}
          categories={[...new Set((data ?? []).map((c) => c.category))]}
        />
      )}
    </div>
  );
}
