import Link from "next/link";
import { Users } from "lucide-react";
import { Badge, Card, CourseCover, Progress } from "@/shared/ui";
import type { Course } from "@/shared/types/domain";

export function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="group block rounded-xl transition-transform duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <Card className="flex h-full flex-col overflow-hidden rounded-xl transition-[border-color,box-shadow] duration-200 group-hover:border-primary/30 group-hover:shadow-elevate">
        <CourseCover
          course={course}
          className="h-32 [&_svg]:transition-transform [&_svg]:duration-500 [&_svg]:ease-out group-hover:[&_svg]:scale-105"
        />

        <div className="flex flex-1 flex-col p-5">
          <div className="font-mono text-xs text-muted-foreground">
            {course.code} · {course.category}
          </div>
          <h3 className="mt-1 line-clamp-2 leading-snug font-semibold group-hover:text-primary">
            {course.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>

          <div className="mt-auto pt-4">
            {course.progress != null && (
              <div className="mb-3 flex items-center gap-3">
                <Progress value={course.progress} className="flex-1" />
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {course.progress}%
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users size={13} aria-hidden /> {course.enrolled} участников
              {/* черновики и архив видят только преподаватель и управление — подписываем словом */}
              {course.status === "draft" && <Badge className="ml-auto">черновик</Badge>}
              {course.status === "archived" && (
                <Badge tone="outline" className="ml-auto">
                  в архиве
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
