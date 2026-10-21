import Link from "next/link";
import { Users, ArrowUpRight } from "lucide-react";
import { Card, Badge, Progress } from "@/shared/ui";
import { gradientFor } from "@/shared/lib/utils";
import type { Course } from "@/shared/types/domain";

export function CourseCard({ course }: { course: Course }) {
  return (
    <Link href={`/courses/${course.id}`} className="group block">
      <Card className="h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-elevate">
        <div
          className={`relative h-24 bg-linear-to-br ${gradientFor(course.id)} flex items-start justify-between px-5 py-4 text-white`}
        >
          <div>
            <div className="text-[11px] tracking-wider uppercase opacity-80">{course.code}</div>
            <div className="mt-1 text-xs font-medium opacity-90">{course.category}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
            <ArrowUpRight size={16} />
          </div>
        </div>

        <div className="p-5">
          <h3 className="line-clamp-2 leading-snug font-semibold">{course.title}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>

          {course.progress != null && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Прогресс</span>
                <span className="font-medium">{course.progress}%</span>
              </div>
              <Progress value={course.progress} />
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users size={13} />
              {course.enrolled} участников
            </div>
            <Badge tone="outline">{course.category}</Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
