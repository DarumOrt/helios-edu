import type { Role } from "@/shared/types/domain";

// Визуальная и смысловая идентичность роли — чтобы роль была "видна" сразу.
export interface RoleMeta {
  label: string;
  workspace: string;
  dashTitle: string;
  dashSubtitle: string;
  /** tailwind-классы акцентного градиента (логотип, hero) */
  gradient: string;
  /** класс цвета текста акцента */
  accentText: string;
  /** класс фона бейджа роли */
  badgeTone: "success" | "info" | "primary" | "warning";
}

export const roleMeta: Record<Role, RoleMeta> = {
  student: {
    label: "Студент",
    workspace: "Личный кабинет",
    dashTitle: "Личный кабинет",
    dashSubtitle: "Ваше обучение и активность",
    gradient: "from-emerald-500 to-teal-500",
    accentText: "text-emerald-600",
    badgeTone: "success",
  },
  tutor: {
    label: "Преподаватель",
    workspace: "Кабинет преподавателя",
    dashTitle: "Кабинет преподавателя",
    dashSubtitle: "Группа М1217 · обучение, проверка, аналитика",
    gradient: "from-blue-500 to-indigo-500",
    accentText: "text-blue-600",
    badgeTone: "info",
  },
  organizer: {
    label: "Организатор",
    workspace: "Кабинет организатора",
    dashTitle: "Кабинет организатора",
    dashSubtitle: "Курсы, программы и учебные группы",
    gradient: "from-violet-500 to-purple-500",
    accentText: "text-violet-600",
    badgeTone: "primary",
  },
  admin: {
    label: "Администратор",
    workspace: "Администрирование",
    dashTitle: "Панель администратора",
    dashSubtitle: "Платформа, пользователи и контроль",
    gradient: "from-amber-500 to-orange-500",
    accentText: "text-amber-600",
    badgeTone: "warning",
  },
};
