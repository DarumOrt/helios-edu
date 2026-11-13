import { describe, expect, it } from "vitest";
import { csvHeaders } from "./import-csv";

describe("заголовки CSV", () => {
  it("BOM, точка с запятой и кавычки", () => {
    expect(csvHeaders('\uFEFF"ФИО";"Почта";"Группа"\r\nИван;ivan@example.org;М1227')).toEqual([
      "ФИО",
      "Почта",
      "Группа",
    ]);
  });
  it("разделители и удвоенные кавычки внутри поля", () => {
    expect(csvHeaders('"Имя, фамилия","Почта ""Email""",group')).toEqual([
      "Имя, фамилия",
      'Почта "Email"',
      "group",
    ]);
  });
});
