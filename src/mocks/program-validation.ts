import { findDemoCourse } from "@/mocks/course-store";
import { str } from "@/mocks/management-guards";
import type { Program } from "@/shared/types/domain";

const RULES: Program["rule"][] = ["sequential", "any-order", "by-deadline"];

/** Поля программы из запроса + ошибки; partial — только переданные (PATCH) */
export function parseProgram(body: Record<string, unknown>, partial: boolean) {
  const out: Partial<Omit<Program, "id">> = {};
  const fields: Record<string, string> = {};
  const has = (k: string) => !partial || body[k] !== undefined;
  if (has("title")) {
    out.title = str(body.title) ?? "";
    if (out.title.length < 3 || out.title.length > 120) fields.title = "Название — от 3 до 120 символов";
  }
  if (has("description")) {
    out.description = str(body.description) ?? "";
    if (out.description.length > 1000) fields.description = "Описание — до 1000 символов";
  }
  if (has("rule")) {
    out.rule = body.rule as Program["rule"];
    if (!RULES.includes(out.rule)) fields.rule = "Выберите правило прохождения";
  }
  if (has("courseIds")) {
    const ids = body.courseIds;
    if (!Array.isArray(ids) || !ids.length || ids.some((c) => typeof c !== "string" || !findDemoCourse(c)))
      fields.courseIds = "Выберите хотя бы один курс";
    else out.courseIds = [...new Set(ids as string[])];
  }
  return { out, fields };
}
