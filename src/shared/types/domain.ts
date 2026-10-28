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
  /** тест: сколько попыток можно завершить (нет — без ограничения) */
  maxAttempts?: number;
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
  /** до 3 подсказок — от намёка к почти готовому решению (P5) */
  hints?: string[];
  /** навык, который проверяет вопрос; нет — навыки материала или модуля */
  skillId?: string | null;
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
  /** загруженный файл работы — открывается по /api/files/{fileId} (только в режиме «Сервер») */
  fileId?: string;
  status: "draft" | "submitted" | "reviewed";
  grade?: number;
  feedback?: string;
  submittedAt?: string;
}

/** Работа с подробностями для проверки: GET /api/submissions, POST /api/submissions/{id}/review */
export interface SubmissionFull extends Submission {
  userName: string;
  group?: string;
  assignmentTitle: string;
  courseId: string;
  courseTitle: string;
  maxGrade: number;
}

/** Вид загружаемого файла — лимиты и форматы в shared/lib/file-rules.ts (зеркало Files/StoredFile.cs) */
export type FileKind = "video" | "document" | "cover" | "submission";

/** Ссылка на загрузку файла в хранилище: POST /api/files → PUT uploadUrl с Content-Type = contentType */
export interface UploadTicket {
  id: string;
  uploadUrl: string;
  contentType: string;
  expiresAt: string;
}

/** Загруженный файл: POST /api/files/{id}/complete; открывается по url (/api/files/{id}) */
export interface UploadedFile {
  id: string;
  kind: string;
  courseId: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
}

/** Одногруппник: GET /api/users?group=… — без почты, контакты видит только управление */
export interface Classmate {
  id: string;
  name: string;
  group?: string;
}

/** Своя работа ученика: GET /api/assignment/{id}/submission?courseId=… (не сдавал — пустой объект) */
export interface MySubmission {
  submission?: SubmissionFull;
}

/** Оценки ученика по курсу: GET /api/gradebook/me → { courses } */
export interface StudentCourseGrades {
  courseId: string;
  courseTitle: string;
  courseCode: string;
  items: { itemId: string; itemTitle: string; grade: number | null; max: number }[];
  total: number;
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

/** Свои попытки теста: GET /api/courses/{id}/quizzes/{activityId}/attempts */
export interface AttemptsSummary {
  /** нет — без ограничения */
  maxAttempts?: number;
  /** сколько попыток завершено */
  used: number;
  /** есть начатая попытка — её можно продолжить */
  open: boolean;
  /** лучший результат в процентах; нет — ещё не завершал */
  bestPercent?: number;
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

export interface StudentMastery {
  pKnown: number;
  status: SkillStatus;
  unlockedByTeacher: boolean;
}

export interface StudentPin {
  activityId: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

/** Панель адаптации преподавателя: GET /api/courses/{id}/adaptive */
export interface AdaptiveDashboard {
  enabled: boolean;
  skills: Skill[];
  students: {
    id: string;
    name: string;
    progress: number;
    skills: Record<string, StudentMastery>;
    pin?: StudentPin | null;
  }[];
}

export interface LearningEvent {
  id: number;
  at: string;
  userId: string;
  actorId: string;
  courseId: string;
  activityId?: string | null;
  skillId?: string | null;
  type: string;
  payload: Record<string, unknown>;
}
