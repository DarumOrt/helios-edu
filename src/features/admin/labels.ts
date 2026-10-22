import type { CourseStatus, Role } from "@/shared/types/domain";

export const roleLabel: Record<Role, string> = {
  student: "Студент",
  tutor: "Преподаватель",
  organizer: "Организатор",
  admin: "Администратор",
};

export const courseStatusMeta: Record<
  CourseStatus,
  { label: string; tone: "neutral" | "success" | "outline" }
> = {
  draft: { label: "черновик", tone: "neutral" },
  published: { label: "опубликован", tone: "success" },
  archived: { label: "в архиве", tone: "outline" },
};
