import Link from "next/link";
import { Users, ArrowUpRight } from "lucide-react";
import { Card, Badge, Progress } from "@/shared/ui";
import { gradientFor } from "@/shared/lib/utils";
import type { Course } from "@/shared/types/domain";

export function CourseCard({ course }: { course: Course }) {
  return (
    <Link href={`/courses/${course.id}`} className="group block">
      <Card className="h-full overflow-hidden hover:shadow-elevate hover:-translate-y-0.5 transition">
        <div
          className={`relative h-24 bg-gradient-to-br ${gradientFor(course.id)} px-5 py-4 flex items-start justify-between text-white`}
        >
          <div>
            <div className="text-[11px] uppercase tracking-wider opacity-80">{course.code}</div>
            <div className="text-xs font-medium mt-1 opacity-90">{course.category}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <ArrowUpRight size={16} />
          </div>
        </div>

        <div className="p-5">
          <h3 className="font-semibold leading-snug line-clamp-2">{course.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5">{course.description}</p>

          {course.progress != null && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Прогресс</span>
                <span className="font-medium">{course.progress}%</span>
              </div>
              <Progress value={course.progress} />
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t">
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
