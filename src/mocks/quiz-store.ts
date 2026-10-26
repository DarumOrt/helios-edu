import { quizQuestions } from "@/mocks/data";
import type { QuizQuestion } from "@/shared/types/domain";

// Вопросы тестов. Ключ — курс + материал: id материалов уникальны только внутри курса.
// В проде — модуль assessment (пока только в моках Next, в т.ч. в серверном режиме).
const g = globalThis as unknown as { __helios_quiz?: Map<string, QuizQuestion[]> };
const store: Map<string, QuizQuestion[]> =
  g.__helios_quiz ??
  (g.__helios_quiz = new Map([
    // исходные наборы: mq1 — матанализ, a3 — тест «основы» во «Введении в педагогику»
    ["c-dor-ai/mq1", quizQuestions.mq1 ?? []],
    ["c-ai-teaching/a3", quizQuestions.a3 ?? []],
  ]));

const key = (courseId: string, activityId: string) => `${courseId}/${activityId}`;

export function getQuestions(courseId: string, activityId: string): QuizQuestion[] {
  return store.get(key(courseId, activityId)) ?? [];
}

export function setQuestions(courseId: string, activityId: string, questions: QuizQuestion[]) {
  store.set(
    key(courseId, activityId),
    questions.map((q, i) => ({ ...q, id: q.id || `q${i + 1}-${crypto.randomUUID().slice(0, 6)}` })),
  );
  return getQuestions(courseId, activityId);
}

/** Для студента — без правильных ответов */
export const publicQuestions = (list: QuizQuestion[]) => list.map(({ correct: _correct, ...q }) => q);

export function scoreAnswers(list: QuizQuestion[], answers: Record<string, unknown>) {
  let score = 0;
  for (const q of list) {
    const given = answers[q.id];
    if (q.type === "short" && typeof given === "string" && typeof q.correct === "string") {
      // как раньше: ответ засчитывается, если содержит правильный (регистр не важен)
      if (given.trim().toLowerCase().includes(q.correct.trim().toLowerCase())) score++;
    } else if (given === q.correct) score++;
  }
  return { score, max: list.length };
}
