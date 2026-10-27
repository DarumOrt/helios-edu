import { BUILDER_ACTIVITY_TYPES, type BuilderActivityType, type QuizQuestion } from "@/shared/types/domain";
import type { FieldErrors } from "./management-validation";

// Проверка содержимого курса (конструктор). Те же правила и тексты — в C# API (docs/backend/p2-course-builder.md).

export interface SectionInput {
  title: string;
}

export interface ActivityInput {
  type: BuilderActivityType;
  title: string;
  /** ISO-дата или null — без срока */
  due?: string | null;
  src?: string | null;
  pages?: number | null;
  durationMin?: number | null;
  description?: string | null;
  maxGrade?: number | null;
  /** тест: сколько попыток можно завершить; null — без ограничения */
  maxAttempts?: number | null;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isInt = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

export function validateSection(input: Partial<SectionInput>): FieldErrors {
  const title = text(input.title);
  return title.length < 2 || title.length > 120 ? { title: "Название модуля — от 2 до 120 символов" } : {};
}

/** partial — проверяем только переданные поля (PATCH); type в PATCH не меняется */
export function validateActivity(input: Partial<ActivityInput>, partial = false): FieldErrors {
  const e: FieldErrors = {};
  const has = (k: keyof ActivityInput) => !partial || input[k] !== undefined;
  if (!partial && !BUILDER_ACTIVITY_TYPES.includes(input.type as BuilderActivityType))
    e.type = "Выберите тип материала";
  const title = text(input.title);
  if (has("title") && (title.length < 2 || title.length > 120)) e.title = "Название — от 2 до 120 символов";
  if (input.due != null && Number.isNaN(Date.parse(input.due))) e.due = "Укажите дату и время сдачи";
  if (input.src != null && input.src !== "") {
    const src = text(input.src);
    if (!/^(https:\/\/|\/)[^\s]+$/.test(src) || src.length > 500)
      e.src = "Ссылка на файл: https://… или путь /media/…, до 500 символов";
  }
  if (input.pages != null && !isInt(input.pages, 1, 500)) e.pages = "Страниц — от 1 до 500";
  if (input.durationMin != null && !isInt(input.durationMin, 1, 600))
    e.durationMin = "Длительность — от 1 до 600 минут";
  if (input.description != null && text(input.description).length > 4000)
    e.description = "Условие — до 4000 символов";
  if (input.maxGrade != null && !isInt(input.maxGrade, 1, 1000))
    e.maxGrade = "Максимальная оценка — от 1 до 1000";
  if (input.maxAttempts != null && !isInt(input.maxAttempts, 1, 20))
    e.maxAttempts = "Попыток — от 1 до 20 или без ограничения";
  // обязательные поля по типу (при создании)
  if (!partial && input.type === "video" && !text(input.src)) e.src = "Укажите ссылку на видеофайл";
  if (!partial && (input.type === "pdf" || input.type === "presentation") && input.pages == null)
    e.pages = "Укажите число страниц";
  return e;
}

/** Вопросы теста: { questions } целиком. Ошибка — у первого неверного вопроса. */
export function validateQuestions(questions: unknown): FieldErrors {
  if (!Array.isArray(questions)) return { questions: "Передайте список вопросов" };
  if (questions.length > 50) return { questions: "В тесте — до 50 вопросов" };
  for (const [i, raw] of questions.entries()) {
    const q = raw as Partial<QuizQuestion>;
    const n = `Вопрос ${i + 1}`;
    if (text(q.text).length < 3 || text(q.text).length > 500)
      return { questions: `${n}: текст — от 3 до 500 символов` };
    if (q.type === "mcq") {
      const opts = q.options;
      if (!Array.isArray(opts) || opts.length < 2 || opts.length > 8 || opts.some((o) => !text(o)))
        return { questions: `${n}: от 2 до 8 непустых вариантов` };
      if (!isInt(q.correct, 0, opts.length - 1)) return { questions: `${n}: отметьте правильный вариант` };
    } else if (q.type === "boolean") {
      if (typeof q.correct !== "boolean") return { questions: `${n}: выберите «верно» или «неверно»` };
    } else if (q.type === "short") {
      if (!text(q.correct)) return { questions: `${n}: укажите правильный ответ` };
    } else return { questions: `${n}: неизвестный тип вопроса` };
    const hints = q.hints ?? [];
    if (
      !Array.isArray(hints) ||
      hints.length > 3 ||
      hints.some((h) => typeof h !== "string" || h.length > 500)
    )
      return { questions: `${n}: не больше 3 подсказок до 500 символов` };
  }
  return {};
}

/** Какие поля есть у материала каждого типа — остальные отбрасываются (то же в C#) */
export const ACTIVITY_FIELDS: Record<BuilderActivityType, (keyof ActivityInput)[]> = {
  video: ["title", "src", "durationMin"],
  pdf: ["title", "pages", "src"],
  presentation: ["title", "pages", "src"],
  quiz: ["title", "due", "durationMin", "maxAttempts"],
  assignment: ["title", "due", "description", "maxGrade"],
};

/** Поля материала из запроса: только разрешённые для типа, строки обрезаны, "" → null */
export function pickActivityFields(
  type: BuilderActivityType,
  raw: Record<string, unknown>,
  partial = false,
): Partial<ActivityInput> {
  const out: Record<string, unknown> = {};
  for (const key of ACTIVITY_FIELDS[type]) {
    const v = raw[key];
    if (v === undefined) continue;
    if (typeof v === "string") out[key] = v.trim() === "" && key !== "title" ? null : v.trim();
    else out[key] = v;
  }
  if (!partial && type === "assignment" && out.maxGrade == null) out.maxGrade = 100;
  return out as Partial<ActivityInput>;
}
