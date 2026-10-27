import { describe, expect, it } from "vitest";
import { FACULTIES, currentAcademicYear, facultyName, isAcademicYear } from "./faculties";

describe("факультеты ПГГПУ", () => {
  it("13 факультетов, коды уникальны (тот же список — Management/Faculties.cs)", () => {
    expect(FACULTIES).toHaveLength(13);
    expect(new Set(FACULTIES.map((f) => f.code)).size).toBe(13);
    expect(facultyName("ИНЭК")).toBe("Факультет информатики и экономики");
  });

  it("учебный год начинается 1 сентября", () => {
    expect(currentAcademicYear(new Date(2026, 9, 27))).toBe("2026/2027");
    expect(currentAcademicYear(new Date(2027, 0, 15))).toBe("2026/2027");
    expect(currentAcademicYear(new Date(2026, 8, 1))).toBe("2026/2027");
    expect(currentAcademicYear(new Date(2026, 7, 31))).toBe("2025/2026");
  });

  it("формат учебного года", () => {
    expect(isAcademicYear("2026/2027")).toBe(true);
    expect(isAcademicYear("2026/2026")).toBe(false);
    expect(isAcademicYear("2026-2027")).toBe(false);
  });
});
