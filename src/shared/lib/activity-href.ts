import type { Activity } from "@/shared/types/domain";

/** Ссылка на страницу активности курса — общая для содержания курса и дашборда. */
export function activityHref(courseId: string, a: Pick<Activity, "id" | "type">) {
  switch (a.type) {
    case "quiz":
      return `/courses/${courseId}/quiz/${a.id}`;
    case "assignment":
      return `/courses/${courseId}/assignment/${a.id}`;
    case "video":
      return `/courses/${courseId}/video/${a.id}`;
    case "pdf":
    case "presentation":
      return `/courses/${courseId}/document/${a.id}`;
    default:
      return `/courses/${courseId}#a-${a.id}`;
  }
}
