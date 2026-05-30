import type { Role } from "@/shared/types/domain";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  ClipboardList,
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
  | "assignment.submit";

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
};

export function can(role: Role, action: Action): boolean {
  return matrix[action]?.includes(role) ?? false;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  group: "main" | "admin";
}

const allItems: NavItem[] = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard, roles: ["admin", "organizer", "tutor", "student"], group: "main" },
  { href: "/courses", label: "Курсы", icon: BookOpen, roles: ["admin", "organizer", "tutor", "student"], group: "main" },
  { href: "/programs", label: "Программы", icon: GraduationCap, roles: ["admin", "organizer", "tutor", "student"], group: "main" },
  { href: "/gradebook", label: "Журнал оценок", icon: ClipboardList, roles: ["admin", "organizer", "tutor", "student"], group: "main" },
  { href: "/admin/courses", label: "Управление курсами", icon: Settings2, roles: ["admin", "organizer"], group: "admin" },
  { href: "/admin/users", label: "Пользователи", icon: Users, roles: ["admin", "organizer"], group: "admin" },
  { href: "/admin/cohorts", label: "Группы", icon: UsersRound, roles: ["admin", "organizer"], group: "admin" },
];

export function navForRole(role: Role) {
  return allItems.filter((item) => item.roles.includes(role));
}
