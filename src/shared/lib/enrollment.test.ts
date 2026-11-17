import { expect, it } from "vitest";
import { keywordError } from "./enrollment";

it("кодовое слово: границы длины и пробелы по краям", () => {
  for (const value of [undefined, null, 1234, "   ", "кот", "я".repeat(65)])
    expect(keywordError(value)).toBe("Кодовое слово — от 4 до 64 символов");
  for (const value of ["Курс", "  Курс  ", "я".repeat(64)]) expect(keywordError(value)).toBeUndefined();
});
