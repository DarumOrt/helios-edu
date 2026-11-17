import type { Activity } from "@/shared/types/domain";

const pages: Partial<Record<Activity["type"], string>> = {
  quiz: "quiz",
  assignment: "assignment",
  video: "video",
  pdf: "document",
  presentation: "document",
};

export function hasActivityPage(type: Activity["type"]) {
  return Boolean(pages[type]);
}

/** Ссылка на страницу активности курса — общая для содержания курса и дашборда. */
export function activityHref(courseId: string, a: Pick<Activity, "id" | "type">) {
  const page = pages[a.type];
  const course = `/courses/${encodeURIComponent(courseId)}`;
  const activity = encodeURIComponent(a.id);
  return page ? `${course}/${page}/${activity}` : `${course}#a-${activity}`;
}
