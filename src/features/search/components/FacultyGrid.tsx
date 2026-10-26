import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { FACULTIES } from "@/shared/lib/faculties";
import type { CatalogCourse } from "@/shared/types/domain";
import { coursesCount } from "../filters";

// Компактная сетка факультетов: клик — все курсы факультета (фильтр ?faculty=…).
export function FacultyGrid({
  courses,
  onPick,
}: {
  courses: CatalogCourse[];
  onPick: (faculty: string) => void;
}) {
  const counts = new Map<string, number>();
  for (const c of courses) if (c.faculty) counts.set(c.faculty, (counts.get(c.faculty) ?? 0) + 1);
  // факультеты с курсами — первыми, дальше в исходном порядке
  const ordered = [...FACULTIES].sort((a, b) => Number(!counts.get(a.code)) - Number(!counts.get(b.code)));

  return (
    <section aria-labelledby="faculties" className="space-y-3">
      <h2 id="faculties" className="text-sm font-medium text-muted-foreground">
        Факультеты
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ordered.map((f) => {
          const n = counts.get(f.code) ?? 0;
          return (
            <li key={f.code}>
              <button
                type="button"
                onClick={() => onPick(f.code)}
                className={cn(
                  "group flex h-full w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left shadow-card transition-[transform,box-shadow] duration-150 ease-out hover:shadow-md active:scale-[0.98]",
                  !n && "opacity-70",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-12 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold",
                    n ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {f.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm leading-snug font-medium">{f.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{coursesCount(n)}</span>
                </span>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
