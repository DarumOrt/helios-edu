import type { Submission } from "@/shared/types/domain";
import { users } from "./data";
import { allDemoUsers } from "./users-store";
import { findActivity, findDemoCourse } from "./course-store";
import { daysAgo } from "./dates";

// In-memory хранилище сдач заданий (мок). В проде — модуль assignment.

export interface AssignmentMeta {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  maxGrade: number;
}

export const ASSIGNMENTS: Record<string, AssignmentMeta> = {
  ma1: {
    id: "ma1",
    title: "Практическая работа: интерактивный тренажёр с помощью ИИ",
    courseId: "c-dor-ai",
    courseTitle: "Практикум по разработке ЦОР с использованием ИИ",
    maxGrade: 100,
  },
  a5: {
    id: "a5",
    title: "Эссе: место ИИ в профессиональном образовании",
    courseId: "c-ai-teaching",
    courseTitle: "Преподавание основ ИИ в профессиональном образовании",
    maxGrade: 100,
  },
};

export interface SubmissionFull extends Submission {
  userName: string;
  group?: string;
  assignmentTitle: string;
  courseId: string;
  courseTitle: string;
  maxGrade: number;
}

interface Store {
  items: Map<string, Submission>;
  seeded: boolean;
}

const g = globalThis as unknown as { __helios_submissions?: Store };
const store: Store = g.__helios_submissions ?? (g.__helios_submissions = { items: new Map(), seeded: false });

function seed() {
  if (store.seeded) return;
  store.seeded = true;

  const seedData: Submission[] = [
    {
      id: "sub-1",
      assignmentId: "ma1",
      userId: "u-stud-1",
      text: "Тренажёр по дробям: задания сгенерированы по промптам, ответы проверены вручную.",
      status: "submitted",
      submittedAt: daysAgo(1, 6),
    },
    {
      id: "sub-2",
      assignmentId: "ma1",
      userId: "u-stud-3",
      text: "Квиз по истории Перми: вопросы собраны с помощью нейросети и вычитаны.",
      status: "submitted",
      submittedAt: daysAgo(1, 4),
    },
    {
      id: "sub-3",
      assignmentId: "ma1",
      userId: "u-stud-5",
      text: "Карточки для запоминания терминов, ссылка на ресурс.",
      status: "submitted",
      submittedAt: daysAgo(0, 5),
    },
    {
      id: "sub-4",
      assignmentId: "ma1",
      userId: "u-stud-6",
      text: "Интерактивный тренажёр с обратной связью и отчётом о проверке фактов.",
      status: "reviewed",
      grade: 88,
      feedback: "Хорошо, но в №4 потеряна область определения.",
      submittedAt: daysAgo(2, 1),
    },
    {
      id: "sub-5",
      assignmentId: "a5",
      userId: "u-stud-7",
      text: "Эссе о том, как вводить основы ИИ в программы колледжей…",
      status: "submitted",
      submittedAt: daysAgo(1, 1),
    },
    {
      id: "sub-6",
      assignmentId: "a5",
      userId: "u-stud-1",
      text: "ИИ как инструмент преподавателя и как предмет изучения…",
      status: "reviewed",
      grade: 90,
      feedback: "Отличная работа, глубокий анализ.",
      submittedAt: daysAgo(3, 2),
    },
    {
      id: "sub-7",
      assignmentId: "a5",
      userId: "u-stud-8",
      text: "Краткое эссе.",
      status: "submitted",
      submittedAt: daysAgo(0, 6),
    },
  ];
  seedData.forEach((s) => store.items.set(s.id, s));
}

function enrich(s: Submission): SubmissionFull {
  const u = allDemoUsers().find((x) => x.id === s.userId) ?? users.find((x) => x.id === s.userId);
  // старые записи без courseId — по таблице исходных заданий
  const courseId = s.courseId ?? ASSIGNMENTS[s.assignmentId]?.courseId ?? "";
  const found = courseId ? findActivity(courseId, s.assignmentId) : undefined;
  const legacy = ASSIGNMENTS[s.assignmentId];
  return {
    ...s,
    userName: u?.name ?? "Студент",
    group: u?.group,
    assignmentTitle: found?.activity.title ?? legacy?.title ?? s.assignmentId,
    courseId,
    courseTitle: found?.course.title ?? findDemoCourse(courseId)?.title ?? legacy?.courseTitle ?? "",
    maxGrade: found?.activity.maxGrade ?? legacy?.maxGrade ?? 100,
  };
}

/** Сдача задания студентом. Повторная сдача до проверки заменяет прежнюю. */
export function submitAssignment(input: {
  courseId: string;
  assignmentId: string;
  userId: string;
  text: string;
  fileName?: string;
}): SubmissionFull {
  seed();
  const previous = Array.from(store.items.values()).find(
    (x) =>
      x.userId === input.userId &&
      x.assignmentId === input.assignmentId &&
      (x.courseId ?? ASSIGNMENTS[x.assignmentId]?.courseId) === input.courseId,
  );
  if (previous?.status === "reviewed") throw new Error("reviewed");
  const item: Submission = {
    id: previous?.id ?? `sub-${crypto.randomUUID().slice(0, 8)}`,
    ...input,
    status: "submitted",
    submittedAt: new Date().toISOString(),
  };
  store.items.set(item.id, item);
  return enrich(item);
}

/** Есть ли сданные работы по заданию — такое задание не удаляем, чтобы не потерять оценки */
export function hasSubmissions(courseId: string, assignmentId: string): boolean {
  seed();
  return Array.from(store.items.values()).some(
    (x) =>
      x.assignmentId === assignmentId && (x.courseId ?? ASSIGNMENTS[x.assignmentId]?.courseId) === courseId,
  );
}

export function listSubmissions(filter?: { status?: Submission["status"] }): SubmissionFull[] {
  seed();
  let arr = Array.from(store.items.values());
  if (filter?.status) arr = arr.filter((s) => s.status === filter.status);
  return arr.map(enrich).sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
}

export function getSubmission(id: string): SubmissionFull | null {
  seed();
  const s = store.items.get(id);
  return s ? enrich(s) : null;
}

export function reviewSubmission(id: string, grade: number, feedback: string): SubmissionFull | null {
  seed();
  const s = store.items.get(id);
  if (!s) return null;
  s.status = "reviewed";
  s.grade = grade;
  s.feedback = feedback;
  store.items.set(id, s);
  return enrich(s);
}

export function pendingCount(): number {
  seed();
  return Array.from(store.items.values()).filter((s) => s.status === "submitted").length;
}
