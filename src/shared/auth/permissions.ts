import type { Role } from "@/shared/types/domain";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  ClipboardList,
  ClipboardCheck,
  BarChart3,
  Trophy,
  Radar,
  Settings2,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type Action =
  | "course.create"
  | "course.edit"
  | "course.view"
  | "user.manage"
  | "cohort.manage"
  | "program.manage"
  | "grade.edit"
  | "submission.review"
  | "quiz.take"
  | "assignment.submit"
  | "analytics.view";

const matrix: Record<Action, Role[]> = {
  "course.create": ["admin", "organizer"],
  "course.edit": ["admin", "organizer", "tutor"],
  "course.view": ["admin", "organizer", "tutor", "student"],
  "user.manage": ["admin", "organizer"],
  "cohort.manage": ["admin", "organizer"],
  "program.manage": ["admin", "organizer"],
  "grade.edit": ["admin", "tutor"],
  "submission.review": ["admin", "tutor"],
  "quiz.take": ["student"],
  "assignment.submit": ["student"],
  "analytics.view": ["admin", "organizer", "tutor"],
};

export function can(role: Role, action: Action): boolean {
  return matrix[action]?.includes(role) ?? false;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: "main" | "admin";
}

// Навигация собирается под конкретную роль — наборы и подписи отличаются.
export function navForRole(role: Role): NavItem[] {
  const items: NavItem[] = [];
  const M = (href: string, label: string, icon: LucideIcon): NavItem => ({ href, label, icon, group: "main" });
  const A = (href: string, label: string, icon: LucideIcon): NavItem => ({ href, label, icon, group: "admin" });

  // Дашборд — у всех
  items.push(M("/dashboard", "Дашборд", LayoutDashboard));

  if (role === "student") {
    items.push(M("/courses", "Мои курсы", BookOpen));
    items.push(M("/programs", "Программы обучения", GraduationCap));
    items.push(M("/hub", "Хаб группы", Trophy));
    items.push(M("/gradebook", "Мои оценки", ClipboardList));
  }

  if (role === "tutor") {
    items.push(M("/courses", "Мои курсы", BookOpen));
    items.push(M("/submissions", "Проверка работ", ClipboardCheck));
    items.push(M("/analytics", "Аналитика групп", BarChart3));
    items.push(M("/hub", "Мониторинг группы", Radar));
    items.push(M("/gradebook", "Журнал оценок", ClipboardList));
  }

  if (role === "organizer") {
    items.push(M("/courses", "Курсы", BookOpen));
    items.push(M("/programs", "Программы обучения", GraduationCap));
    items.push(M("/analytics", "Аналитика групп", BarChart3));
    items.push(M("/gradebook", "Журнал оценок", ClipboardList));
    items.push(A("/admin/courses", "Управление курсами", Settings2));
    items.push(A("/admin/users", "Пользователи", Users));
    items.push(A("/admin/cohorts", "Группы", UsersRound));
  }

  if (role === "admin") {
    items.push(M("/courses", "Курсы", BookOpen));
    items.push(M("/submissions", "Проверка работ", ClipboardCheck));
    items.push(M("/analytics", "Аналитика групп", BarChart3));
    items.push(M("/gradebook", "Журнал оценок", ClipboardList));
    items.push(A("/admin/courses", "Управление курсами", Settings2));
    items.push(A("/admin/users", "Пользователи", Users));
    items.push(A("/admin/cohorts", "Группы", UsersRound));
  }

  return items;
}
