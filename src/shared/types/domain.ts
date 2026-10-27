import type { CoverColor } from "@/shared/lib/cover-colors";

export type Role = "admin" | "organizer" | "tutor" | "student";

export type UserStatus = "active" | "blocked";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  avatarUrl?: string;
  faculty?: string;
  /** название группы (когорты); у не-студентов не задаётся */
  group?: string;
  /** нет поля — активен (старые ответы C# API его не содержат) */
  status?: UserStatus;
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
  /** задание: условие для студента */
  description?: string;
  /** задание: максимальная оценка (по умолчанию 100) */
  maxGrade?: number;
}

/** Типы материалов, которые можно создать в конструкторе курса */
export const BUILDER_ACTIVITY_TYPES = ["video", "pdf", "presentation", "quiz", "assignment"] as const;
export type BuilderActivityType = (typeof BUILDER_ACTIVITY_TYPES)[number];

export interface Announcement {
  id: string;
  courseId: string;
  title: string;
  body: string;
  authorName: string;
  createdAt: string;
}

export interface Section {
  id: string;
  title: string;
  order: number;
  activities: Activity[];
}

export type CourseStatus = "draft" | "published" | "archived";

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
  /** короткое название факультета, как у групп: «ИНЭК» */
  faculty?: string;
  /** учебный год, например «2026/2027» */
  academicYear?: string;
  /** нет поля — опубликован. Студенты видят только опубликованные курсы */
  status?: CourseStatus;
  enrolled: number;
  progress?: number;
  sections?: Section[];
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
  /** курс задания: id материалов уникальны только внутри курса */
  courseId?: string;
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
  faculty?: string;
  /** курс обучения: 1–5 в бакалавриате, 1–2 в магистратуре */
  year?: number;
  level?: "bachelor" | "master";
  /** направление подготовки: код и название, например 44.04.01 «Педагогическое образование» */
  directionCode?: string;
  direction?: string;
  /** профиль (направленность) */
  profile?: string;
  /** студенты группы — производное от User.group */
  memberIds: string[];
  /** курсы группы: каждый её студент зачислен на них */
  courseIds: string[];
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

/** Поиск курсов (GET /api/catalog): карточка без материалов. accessible — курс открывается пользователю */
export interface CatalogCohort {
  id: string;
  name: string;
  year?: number;
  level?: "bachelor" | "master";
  directionCode?: string;
  direction?: string;
  profile?: string;
}

export interface CatalogCourse {
  id: string;
  code: string;
  title: string;
  description: string;
  cover?: string;
  coverColor?: CoverColor;
  category: string;
  faculty?: string;
  academicYear?: string;
  tutor: { id: string; name: string };
  cohorts: CatalogCohort[];
  sections: { title: string; activities: number }[];
  accessible: boolean;
}

// ---- Адаптивное обучение (P5). Контракт — docs/backend/p5-adaptive.md, один для моков и C# ----

export type SkillStatus = "locked" | "learning" | "mastered";

export interface Skill {
  id: string;
  courseId: string;
  sectionId?: string | null;
  code?: string | null;
  title: string;
  description?: string | null;
  order: number;
  /** создан системой для модуля без навыков */
  isAuto: boolean;
  pInit: number;
  pLearn: number;
  pSlip: number;
  pGuess: number;
  prerequisiteIds: string[];
  activityIds: string[];
}

/** Вопрос теста: преподаватель видит всё, ученик — без correct и hints, с hintsCount */
export interface AdaptiveQuestion {
  id: string;
  type: "mcq" | "short" | "boolean";
  text: string;
  options: string[];
  correct?: number | string | boolean;
  hints?: string[];
  hintsCount?: number;
  skillId?: string | null;
  order: number;
}

export interface AttemptStart {
  attemptId: string;
  questions: AdaptiveQuestion[];
}

export interface SkillChange {
  skillId: string;
  before: number;
  after: number;
  status: SkillStatus;
}

export interface AnswerResult {
  isCorrect: boolean;
  correct: number | string | boolean;
  skills: SkillChange[];
}

export interface HintResult {
  level: number;
  text: string;
  hintsLeft: number;
}

export interface AttemptResult {
  score: number;
  max: number;
  percent: number;
}

export interface SkillProgress {
  id: string;
  title: string;
  code?: string | null;
  pKnown: number;
  status: SkillStatus;
}

export interface AdaptiveProgress {
  progress: number;
  skills: SkillProgress[];
  materials: { done: number; total: number };
}

export type ReasonCode =
  "pinned_by_teacher" | "linear_order" | "weakest_skill" | "review_material" | "all_mastered";

export interface AdaptiveNext {
  recommendation: {
    id: string;
    activityId?: string | null;
    skillId?: string | null;
    reasonCode: ReasonCode;
    reasonText: string;
  };
  /** материалы для повторения по слабым навыкам */
  personal: { skillId: string; activityIds: string[] }[];
}
