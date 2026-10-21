import Image from "next/image";
import { cn } from "@/shared/lib/utils";
import { COVER_COLORS, fallbackCoverColor } from "@/shared/lib/cover-colors";
import type { Course } from "@/shared/types/domain";

// Обложка курса — один шаблон для всех: цвет, солнце в углу и горизонт-линейка (мотив знака HeliosEDU).
// Если у курса загружена своя картинка, она закрывает шаблон, а бейдж с кодом остаётся поверх.

type CoverCourse = Pick<Course, "id" | "code" | "cover" | "coverColor">;

export function CourseCover({
  course,
  variant = "card",
  className,
}: {
  course: CoverCourse;
  /** card — карточка курса, banner — шапка страницы курса, thumb — миниатюра в списках */
  variant?: "card" | "banner" | "thumb";
  className?: string;
}) {
  const color = COVER_COLORS[course.coverColor ?? fallbackCoverColor(course.id)];
  const thumb = variant === "thumb";

  return (
    <div
      className={cn("relative isolate overflow-hidden", className)}
      style={{ backgroundColor: color.bg }}
      aria-hidden={thumb || undefined}
    >
      {course.cover ? (
        <Image
          src={course.cover}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 480px"
          className="object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 320 120"
          preserveAspectRatio="xMaxYMid slice"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <circle cx="282" cy="18" r="78" fill={color.shape} opacity=".14" />
          <circle cx="282" cy="18" r="40" fill={color.shape} opacity=".18" />
          <circle cx="232" cy="88" r="7" fill={color.shape} opacity=".35" />
          <line x1="0" y1="100" x2="320" y2="100" stroke={color.shape} strokeOpacity=".35" />
          {Array.from({ length: 17 }, (_, i) => (
            <line
              key={i}
              x1={i * 20 + 10}
              y1="100"
              x2={i * 20 + 10}
              y2={i % 5 === 0 ? 110 : 105}
              stroke={color.shape}
              strokeOpacity=".3"
            />
          ))}
        </svg>
      )}
      {!thumb && (
        <span
          className={cn(
            "absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-0.5 font-mono text-xs font-medium text-[#14213D]",
            variant === "banner" && "top-4 left-5",
          )}
        >
          {course.code}
        </span>
      )}
    </div>
  );
}
