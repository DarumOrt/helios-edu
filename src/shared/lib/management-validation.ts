import { EMAIL } from "./registration";
import type { CourseStatus, Role, UserStatus } from "@/shared/types/domain";
import { FACULTY_CODES, isAcademicYear } from "./faculties";

// Проверка полей форм управления. Те же правила и тексты — в C# API (docs/backend/p1-management.md).
export type FieldErrors = Record<string, string>;

const ROLES: Role[] = ["student", "tutor", "organizer", "admin"];
const USER_STATUSES: UserStatus[] = ["active", "blocked"];
export const COURSE_STATUSES: CourseStatus[] = ["draft", "published", "archived"];
export const COURSE_CODE = /^[А-ЯЁA-Z]{2,6}-\d{3}$/;

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  /** название группы; только для студента, null — без группы */
  group?: string | null;
  faculty?: string | null;
  status?: UserStatus;
}

export interface CohortInput {
  name: string;
  faculty?: string | null;
}

export interface CourseInput {
  code: string;
  title: string;
  category: string;
  description: string;
  tutorId: string;
  status?: CourseStatus;
  /** факультет (код из FACULTIES) и учебный год «2026/2027» — необязательны, нужны для поиска */
  faculty?: string;
  academicYear?: string;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** partial — проверяем только переданные поля (PATCH) */
export function validateUser(input: Partial<UserInput>, partial = false): FieldErrors {
  const e: FieldErrors = {};
  const has = (k: keyof UserInput) => !partial || input[k] !== undefined;
  const name = text(input.name);
  const email = text(input.email);

  if (has("name") && (name.length < 2 || name.length > 100))
    e.name = "Укажите имя и фамилию — от 2 до 100 символов";
  if (has("email") && (!email || email.length > 254 || !EMAIL.test(email)))
    e.email = "Почта выглядит неполной, например name@pspu.ru";
  if (has("role") && !ROLES.includes(input.role as Role)) e.role = "Выберите роль";
  if (input.status !== undefined && !USER_STATUSES.includes(input.status)) e.status = "Неизвестный статус";
  if (input.faculty != null && text(input.faculty).length > 50) e.faculty = "Факультет — до 50 символов";
  // Группа есть только у студента
  if (input.group && input.role && input.role !== "student")
    e.group = "Группу можно назначить только студенту";
  return e;
}

export function validateCohort(input: Partial<CohortInput>, partial = false): FieldErrors {
  const e: FieldErrors = {};
  const name = text(input.name);
  if ((!partial || input.name !== undefined) && !/^[\p{L}\d][\p{L}\d -]{1,29}$/u.test(name))
    e.name = "Название — от 2 до 30 символов: буквы, цифры, дефис, например М1227";
  if (input.faculty != null && text(input.faculty).length > 50) e.faculty = "Факультет — до 50 символов";
  return e;
}

export function validateCourse(input: Partial<CourseInput>, partial = false): FieldErrors {
  const e: FieldErrors = {};
  const has = (k: keyof CourseInput) => !partial || input[k] !== undefined;
  if (has("code") && !COURSE_CODE.test(text(input.code)))
    e.code = "Код — заглавные буквы, дефис и три цифры, например МАТ-101";
  const title = text(input.title);
  if (has("title") && (title.length < 3 || title.length > 120)) e.title = "Название — от 3 до 120 символов";
  const category = text(input.category);
  if (has("category") && (category.length < 2 || category.length > 50))
    e.category = "Укажите направление, например Математика";
  if (has("description") && text(input.description).length > 1000)
    e.description = "Описание — до 1000 символов";
  if (has("tutorId") && !text(input.tutorId)) e.tutorId = "Назначьте преподавателя";
  const faculty = text(input.faculty);
  if (faculty && !FACULTY_CODES.includes(faculty)) e.faculty = "Выберите факультет из списка";
  const academicYear = text(input.academicYear);
  if (academicYear && !isAcademicYear(academicYear)) e.academicYear = "Учебный год в формате 2026/2027";
  if (input.status !== undefined && !COURSE_STATUSES.includes(input.status)) e.status = "Неизвестный статус";
  return e;
}
