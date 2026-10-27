import { describe, expect, it } from "vitest";
import { validateCohort, validateCourse, validateUser } from "./management-validation";

// Тексты — как в ManagementInput.cs и docs/backend/p1-management.md.
describe("validateUser", () => {
  it("группа только у студента", () => {
    expect(
      validateUser({ name: "Имя Фамилия", email: "a@pspu.ru", role: "tutor", group: "М1227" }).group,
    ).toBe("Группу можно назначить только студенту");
  });

  it("PATCH проверяет только переданные поля", () => {
    expect(validateUser({ status: "blocked" }, true)).toEqual({});
    expect(validateUser({ email: "плохо" }, true)).toEqual({
      email: "Почта выглядит неполной, например name@pspu.ru",
    });
  });
});

describe("validateCohort", () => {
  it("название группы: цифры и буквы, как в расписании", () => {
    expect(validateCohort({ name: "1237" })).toEqual({});
    expect(validateCohort({ name: "М1227" })).toEqual({});
    expect(validateCohort({ name: "!" }).name).toMatch(/^Название — от 2 до 30 символов/);
  });
});

describe("validateCourse", () => {
  const course = {
    code: "ЦОР-201",
    title: "Практикум",
    category: "ЦОР",
    description: "",
    tutorId: "u-tutor-1",
  };

  it("корректный курс", () => {
    expect(validateCourse(course)).toEqual({});
  });

  it("код — заглавные буквы, дефис и три цифры", () => {
    expect(validateCourse({ ...course, code: "цор-1" }).code).toBe(
      "Код — заглавные буквы, дефис и три цифры, например МАТ-101",
    );
  });

  it("факультет из списка ПГГПУ, учебный год — соседние годы", () => {
    expect(validateCourse({ ...course, faculty: "ИНЭК", academicYear: "2026/2027" })).toEqual({});
    expect(validateCourse({ ...course, faculty: "ПНИПУ" }).faculty).toBe("Выберите факультет из списка");
    expect(validateCourse({ ...course, academicYear: "2026/2028" }).academicYear).toBe(
      "Учебный год в формате 2026/2027",
    );
  });
});
