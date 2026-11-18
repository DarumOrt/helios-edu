import { describe, expect, it } from "vitest";
import { passwordChecks, validateRegistration } from "./registration";

// Тексты совпадают с AuthEndpoints.ValidateRegistration (C#) — меняются вместе.
const valid = { name: "Имя Фамилия", email: "name@pspu.ru", consent: true };

describe("validateRegistration", () => {
  it("корректная форма — без ошибок", () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it("пустая форма — ошибка в каждом поле", () => {
    expect(validateRegistration({})).toEqual({
      name: "Укажите имя и фамилию",
      email: "Укажите почту",
      consent: "Без согласия мы не сможем принять заявку",
    });
  });

  it("почта без домена", () => {
    const e = validateRegistration({ ...valid, email: "name@pspu" });
    expect(e.email).toBe("Почта выглядит неполной, например name@pspu.ru");
  });

  it("имя обрезается по краям, слишком длинное — ошибка", () => {
    expect(validateRegistration({ ...valid, name: "  А  " }).name).toBe("Укажите имя и фамилию");
    expect(validateRegistration({ ...valid, name: "я".repeat(101) }).name).toBe(
      "Имя длиннее 100 символов — сократите",
    );
  });
});

describe("passwordChecks — подсказки под полем пароля", () => {
  it("кириллица считается буквой", () => {
    expect(passwordChecks("пароль12").every((c) => c.ok)).toBe(true);
    expect(passwordChecks("12345678")[1].ok).toBe(false);
  });
});
