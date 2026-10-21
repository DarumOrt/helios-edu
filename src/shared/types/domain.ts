import type { CoverColor } from "@/shared/lib/cover-colors";

export type Role = "admin" | "organizer" | "tutor" | "student";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  avatarUrl?: string;
  faculty?: string;
  group?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export type ActivityType =
  "quiz" | "assignment" | "file" | "forum" | "page" | "video" | "pdf" | "presentation";

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  durationMin?: number;
  completed?: boolean;
  due?: string;
  /** для video — путь к файлу */
  src?: string;
  /** для pdf/presentation — число страниц/слайдов */
  pages?: number;
}

export interface Section {
  id: string;
  title: string;
  order: number;
  activities: Activity[];
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  /** своя обложка (URL или data URL); если нет — шаблон с цветом coverColor */
  cover?: string;
  /** цвет шаблонной обложки, назначается случайно при создании курса */
  coverColor?: CoverColor;
  category: string;
  tutorId: string;
  enrolled: number;
  progress?: number;
  sections?: Section[];
}

export interface Program {
  id: string;
  title: string;
  description: string;
  courseIds: string[];
  rule: "sequential" | "any-order" | "by-deadline";
}

export interface QuizQuestion {
  id: string;
  type: "mcq" | "short" | "boolean";
  text: string;
  options?: string[];
  correct?: number | string | boolean;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  answers: Record<string, unknown>;
  score?: number;
  state: "in_progress" | "submitted" | "graded";
  submittedAt?: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  userId: string;
  text: string;
  fileName?: string;
  status: "draft" | "submitted" | "reviewed";
  grade?: number;
  feedback?: string;
  submittedAt?: string;
}

export interface GradeRow {
  userId: string;
  userName: string;
  items: { itemId: string; itemTitle: string; grade: number | null; max: number }[];
  total: number;
}

/** Пара в расписании группы */
export interface ScheduleSlot {
  id: string;
  courseId: string;
  /** 1 — понедельник … 6 — суббота */
  weekday: number;
  /** номер пары */
  pair: number;
  kind: "lecture" | "practice" | "seminar";
  room: string;
}

export interface PairTime {
  n: number;
  start: string;
  end: string;
}

export interface Cohort {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Notification {
  id: string;
  type: "deadline" | "grade" | "announcement" | "forum";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string;
}
