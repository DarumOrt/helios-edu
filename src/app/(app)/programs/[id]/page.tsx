"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Lock, Pencil } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Badge, Breadcrumbs, Button, Card, CourseCover, DataState, PageHeader, Progress } from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { ProgramDialog, ruleLabel } from "@/features/programs/components/ProgramDialog";
import type { Course, Program } from "@/shared/types/domain";

export default function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const role = useSession((s) => s.role);
  const { data: program, error, isLoading } = useSWR<Program>(`/api/programs/${id}`, fetcher);
  const { data: courses } = useSWR<Course[]>("/api/courses", fetcher);
  const [editing, setEditing] = useState(false);
  const byId = new Map((courses ?? []).map((c) => [c.id, c]));

  return (
    <DataState loading={isLoading} error={error} empty={!program} emptyTitle="Программа не найдена">
      {program && (
        <div className="max-w-3xl">
          <PageHeader
            title={program.title}
            subtitle={program.description}
            breadcrumbs={
              <Breadcrumbs
                items={[{ label: "Программы обучения", href: "/programs" }, { label: program.title }]}
              />
            }
            actions={
              can(role, "program.manage") && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil size={15} aria-hidden /> Изменить
                </Button>
              )
            }
          />
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge tone="info">{ruleLabel[program.rule]}</Badge>
            {program.courseIds.length} курсов
          </div>
          <ol className="space-y-2">
            {program.courseIds.map((cid, i) => {
              const c = byId.get(cid);
              return (
                <li key={cid}>
                  <Card className="flex items-center gap-4 p-3">
                    <span className="w-6 text-center font-mono text-sm text-muted-foreground">{i + 1}</span>
                    {c ? (
                      <Link
                        href={`/courses/${c.id}`}
                        className="group flex min-w-0 flex-1 items-center gap-3"
                      >
                        <CourseCover course={c} variant="thumb" className="h-10 w-16 shrink-0 rounded-md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium group-hover:text-primary">
                            {c.title}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                        </span>
                        {c.progress != null && <Progress value={c.progress} className="w-24" />}
                      </Link>
                    ) : (
                      // курс программы, на который пользователь не зачислен (или ещё не опубликован)
                      <span className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
                        <Lock size={15} aria-hidden /> Курс пока недоступен
                      </span>
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
          {editing && (
            <ProgramDialog program={program} courses={courses ?? []} onClose={() => setEditing(false)} />
          )}
        </div>
      )}
    </DataState>
  );
}
