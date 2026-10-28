"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TriangleAlert } from "lucide-react";
import { Button, Dialog, Skeleton } from "@/shared/ui";
import { apiErrorInfo, fetcher } from "@/shared/lib/api-client";
import type { Course, CourseImpact } from "@/shared/types/domain";
import { coursesApi } from "../api";

const plural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const t = n % 100;
  return `${n} ${d === 1 && t !== 11 ? one : d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many}`;
};

/**
 * Удаление курса в корзину на 7 дней. Если по курсу есть результаты учеников — предупреждаем:
 * пока курс в корзине, оценки сохраняются; после окончательного удаления рейтинг считается без него.
 */
export function DeleteCourseDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: impact, error } = useSWR<CourseImpact>(`/api/courses/${course.id}/impact`, fetcher);
  const [pending, setPending] = useState(false);
  const results = impact ? impact.submissions + impact.grades + impact.attempts : 0;

  async function remove() {
    setPending(true);
    try {
      await coursesApi.remove(course.id);
      await mutate((key) => typeof key === "string" && key.startsWith("/api/courses"));
      toast.success("Курс в корзине", {
        description: "7 дней его можно восстановить: «Курсы» → «Корзина курсов»",
      });
      onClose();
      router.push("/courses");
    } catch (failure) {
      toast.error("Курс не удалён", { description: apiErrorInfo(failure).error });
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Удалить курс?"
      description={`${course.code} · ${course.title}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={remove} disabled={pending || !impact}>
            {pending ? "Удаляем…" : results ? "Всё равно удалить" : "Удалить"}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="text-sm text-muted-foreground">
          {apiErrorInfo(error).error ?? "Не удалось проверить курс"}
        </p>
      ) : !impact ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <div className="space-y-3 text-sm">
          {results > 0 && (
            <div role="alert" className="flex gap-2 rounded-md bg-warning-soft px-3 py-2 text-warning">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              <p>
                В курсе есть результаты учеников:{" "}
                {[
                  impact.submissions &&
                    plural(impact.submissions, "сданная работа", "сданные работы", "сданных работ"),
                  impact.grades && plural(impact.grades, "оценка", "оценки", "оценок"),
                  impact.attempts &&
                    plural(impact.attempts, "попытка теста", "попытки тестов", "попыток тестов"),
                ]
                  .filter(Boolean)
                  .join(", ")}
                . Они влияют на рейтинг студентов.
              </p>
            </div>
          )}
          <p>
            Курс уйдёт в корзину на <b>7 дней</b>: студенты его больше не увидят, но оценки по нему сохранятся
            в их рейтинге. Если курс нужен только «закрыть» — переведите его в архив в карточке курса.
          </p>
          <p className="text-muted-foreground">
            Через 7 дней курс удалится окончательно вместе с работами и оценками
            {impact.students ? ` ${plural(impact.students, "студента", "студентов", "студентов")}` : ""}, и
            рейтинг пересчитается без него.
          </p>
        </div>
      )}
    </Dialog>
  );
}
