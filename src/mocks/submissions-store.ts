import type { Submission } from "@/shared/types/domain";
import { users } from "./data";

// In-memory хранилище сдач заданий (мок). В проде — модуль assignment.

export interface AssignmentMeta {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  maxGrade: number;
}

export const ASSIGNMENTS: Record<string, AssignmentMeta> = {
  ma1: { id: "ma1", title: "Домашнее задание: вычисление пределов", courseId: "c-matan", courseTitle: "Математический анализ", maxGrade: 100 },
  a5: { id: "a5", title: "Эссе: Каменский", courseId: "c-ped-101", courseTitle: "Введение в педагогику", maxGrade: 100 },
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
    { id: "sub-1", assignmentId: "ma1", userId: "u-stud-1", text: "Решение через первый замечательный предел…", status: "submitted", submittedAt: "2026-06-01T10:20:00Z" },
    { id: "sub-2", assignmentId: "ma1", userId: "u-stud-3", text: "lim (1+1/n)^n = e, далее по теореме…", status: "submitted", submittedAt: "2026-06-01T12:05:00Z" },
    { id: "sub-3", assignmentId: "ma1", userId: "u-stud-5", text: "Пределы вычислены по правилу Лопиталя.", status: "submitted", submittedAt: "2026-06-02T09:00:00Z" },
    { id: "sub-4", assignmentId: "ma1", userId: "u-stud-6", text: "Полное решение всех 5 пределов.", status: "reviewed", grade: 88, feedback: "Хорошо, но в №4 потеряна область определения.", submittedAt: "2026-05-31T18:40:00Z" },
    { id: "sub-5", assignmentId: "a5", userId: "u-stud-7", text: "Эссе о вкладе Я. А. Коменского…", status: "submitted", submittedAt: "2026-06-01T15:30:00Z" },
    { id: "sub-6", assignmentId: "a5", userId: "u-stud-1", text: "«Великая дидактика» как основа педагогики…", status: "reviewed", grade: 90, feedback: "Отличная работа, глубокий анализ.", submittedAt: "2026-05-30T11:00:00Z" },
    { id: "sub-7", assignmentId: "a5", userId: "u-stud-8", text: "Краткое эссе.", status: "submitted", submittedAt: "2026-06-02T08:15:00Z" },
  ];
  seedData.forEach((s) => store.items.set(s.id, s));
}

function enrich(s: Submission): SubmissionFull {
  const u = users.find((x) => x.id === s.userId);
  const a = ASSIGNMENTS[s.assignmentId];
  return {
    ...s,
    userName: u?.name ?? "Студент",
    group: u?.group,
    assignmentTitle: a?.title ?? s.assignmentId,
    courseId: a?.courseId ?? "",
    courseTitle: a?.courseTitle ?? "",
    maxGrade: a?.maxGrade ?? 100,
  };
}

export function listSubmissions(filter?: { status?: Submission["status"] }): SubmissionFull[] {
  seed();
  let arr = Array.from(store.items.values());
  if (filter?.status) arr = arr.filter((s) => s.status === filter.status);
  return arr
    .map(enrich)
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
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
