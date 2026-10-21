import type { Role } from "@/shared/types/domain";

// Визуальная и смысловая идентичность роли — чтобы роль была "видна" сразу.
export interface RoleMeta {
  label: string;
  workspace: string;
  dashTitle: string;
  dashSubtitle: string;
  /** класс фона бейджа роли */
  badgeTone: "success" | "info" | "primary" | "warning" | "neutral";
}

export const roleMeta: Record<Role, RoleMeta> = {
  student: {
    label: "Студент",
    workspace: "Личный кабинет",
    dashTitle: "Личный кабинет",
    dashSubtitle: "Ваше обучение и активность",
    badgeTone: "success",
  },
  tutor: {
    label: "Преподаватель",
    workspace: "Кабинет преподавателя",
    dashTitle: "Кабинет преподавателя",
    dashSubtitle: "Группа М1217 · обучение, проверка, аналитика",
    badgeTone: "info",
  },
  organizer: {
    label: "Организатор",
    workspace: "Кабинет организатора",
    dashTitle: "Кабинет организатора",
    dashSubtitle: "Курсы, программы и учебные группы",
    badgeTone: "primary",
  },
  admin: {
    label: "Администратор",
    workspace: "Администрирование",
    dashTitle: "Панель администратора",
    dashSubtitle: "Платформа, пользователи и контроль",
    badgeTone: "warning",
  },
};
