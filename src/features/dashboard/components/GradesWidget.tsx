"use client";

import Link from "next/link";
import useSWR from "swr";
import { ClipboardList } from "lucide-react";
import { useSession } from "@/shared/auth/session";
import { fetcher } from "@/shared/lib/api-client";
import { Badge, DataState, Disclosure } from "@/shared/ui";
import type { StudentCourseGrades } from "@/shared/types/domain";
import { pluralCount } from "@/shared/lib/format";

export function GradesWidget() {
  const userId = useSession((s) => s.user.id);
  const { data, error, isLoading } = useSWR<{ courses: StudentCourseGrades[] }>(
    `/api/gradebook/me?userId=${encodeURIComponent(userId)}`,
    fetcher,
  );
  const graded =
    data?.courses.flatMap((course) =>
      course.items.filter((item) => item.grade != null).map((item) => ({ ...item, course })),
    ) ?? [];

  return (
    <Disclosure
      title="Оценки"
      icon={<ClipboardList size={17} />}
      meta={data && pluralCount(graded.length, "оценка", "оценки", "оценок")}
    >
      <DataState loading={isLoading} error={error} empty={!graded.length} emptyTitle="Оценок пока нет">
        <ul className="divide-y">
          {graded.slice(0, 4).map(({ course, itemId, itemTitle, grade, max }) => (
            <li
              key={`${course.courseId}/${itemId}`}
              className="flex items-start justify-between gap-2 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm leading-snug font-medium">{itemTitle}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{course.courseTitle}</p>
              </div>
              <Badge tone="primary" className="shrink-0">
                {grade} из {max}
              </Badge>
            </li>
          ))}
        </ul>
      </DataState>
      <Link
        href="/gradebook"
        className="inline-block py-2 text-sm font-medium text-primary underline-offset-3 hover:underline"
      >
        Все оценки
      </Link>
    </Disclosure>
  );
}
