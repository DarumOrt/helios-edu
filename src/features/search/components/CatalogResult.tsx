import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge, CourseCover } from "@/shared/ui";
import type { CatalogCourse } from "@/shared/types/domain";

// Курс в результатах поиска: свой курс открывается сразу, чужой — карточкой без материалов.
export function CatalogResult({ course }: { course: CatalogCourse }) {
  const href = course.accessible ? `/courses/${course.id}` : `/search/${course.id}`;
  return (
    <Link
      href={href}
      className="flex h-full gap-4 rounded-xl bg-card p-3 shadow-card transition-[transform,box-shadow] duration-150 ease-out hover:shadow-md active:scale-[0.99]"
    >
      <CourseCover course={course} variant="thumb" className="h-20 w-20 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
          <span>{course.code}</span>
          {course.faculty && <span>· {course.faculty}</span>}
          {course.academicYear && <span>· {course.academicYear}</span>}
        </div>
        <h3 className="mt-1 line-clamp-2 text-sm leading-snug font-medium">{course.title}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {course.tutor.name || "Преподаватель не назначен"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {course.cohorts.slice(0, 3).map((g) => (
            <Badge key={g.id} tone="neutral">
              {g.name}
            </Badge>
          ))}
          {course.cohorts.length > 3 && <Badge tone="outline">+{course.cohorts.length - 3}</Badge>}
          {!course.accessible && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock size={12} aria-hidden /> только карточка
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
