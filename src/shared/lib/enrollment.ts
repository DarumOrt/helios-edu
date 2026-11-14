/** Кодовое слово чувствительно к регистру; пробелы по краям не учитываются. Зеркало C# SetKeyAsync. */
export function keywordError(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length < 4 || value.trim().length > 64)
    return "Кодовое слово — от 4 до 64 символов";
}
