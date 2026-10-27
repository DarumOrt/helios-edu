import { describe, expect, it } from "vitest";
import { passwordChecks, validateRegistration } from "./registration";

// Тексты совпадают с AuthEndpoints.ValidateRegistration (C#) — меняются вместе.
const valid = { name: "Имя Фамилия", email: "name@pspu.ru", password: "parol123", consent: true };

describe("validateRegistration", () => {
  it("корректная форма — без ошибок", () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it("пустая форма — ошибка в каждом поле", () => {
    expect(validateRegistration({})).toEqual({
      name: "Укажите имя и фамилию",
      email: "Укажите почту",
      password: "Придумайте пароль",
      consent: "Без согласия мы не сможем создать учётную запись",
    });
  });

  it("почта без домена и пароль без цифры", () => {
    const e = validateRegistration({ ...valid, email: "name@pspu", password: "простопароль" });
    expect(e.email).toBe("Почта выглядит неполной, например name@pspu.ru");
    expect(e.password).toBe("Пароль: не короче 8 символов, буквы и цифра");
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
