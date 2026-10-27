import { describe, expect, it } from "vitest";
import { pickActivityFields, validateActivity, validateQuestions } from "./content-validation";

describe("validateQuestions — вопросы теста", () => {
  it("правильный набор с подсказками", () => {
    expect(
      validateQuestions([
        {
          id: "q1",
          type: "mcq",
          text: "Что такое ЦОР?",
          options: ["Тренажёр", "Доска"],
          correct: 0,
          hints: ["Намёк"],
        },
        { id: "q2", type: "boolean", text: "ИИ ошибается?", correct: true },
        { id: "q3", type: "short", text: "Запрос к нейросети?", correct: "промпт" },
      ]),
    ).toEqual({});
  });

  it("у mcq — от 2 вариантов и отмеченный правильный", () => {
    expect(
      validateQuestions([{ id: "", type: "mcq", text: "Вопрос?", options: ["один"], correct: 0 }]).questions,
    ).toBe("Вопрос 1: от 2 до 8 непустых вариантов");
    expect(
      validateQuestions([{ id: "", type: "mcq", text: "Вопрос?", options: ["а", "б"], correct: 5 }])
        .questions,
    ).toBe("Вопрос 1: отметьте правильный вариант");
  });

  it("не больше трёх подсказок", () => {
    expect(
      validateQuestions([
        { id: "", type: "boolean", text: "Вопрос?", correct: true, hints: ["1", "2", "3", "4"] },
      ]).questions,
    ).toBe("Вопрос 1: не больше 3 подсказок до 500 символов");
  });
});

describe("pickActivityFields — лишние поля материала отбрасываются", () => {
  it("у видео нет срока сдачи", () => {
    const fields = pickActivityFields("video", { title: " Лекция ", src: "/media/x.mp4", due: "2026-11-01" });
    expect(fields).toMatchObject({ title: "Лекция", src: "/media/x.mp4" });
    expect(fields).not.toHaveProperty("due");
  });
});

describe("validateActivity — лимит попыток теста (ContentInput.cs)", () => {
  it("от 1 до 20, пусто — без ограничения", () => {
    const quiz = { type: "quiz" as const, title: "Тест" };
    expect(validateActivity({ ...quiz, maxAttempts: 3 })).toEqual({});
    expect(validateActivity({ ...quiz, maxAttempts: null })).toEqual({});
    for (const bad of [0, 21, 1.5])
      expect(validateActivity({ ...quiz, maxAttempts: bad }).maxAttempts).toBe(
        "Попыток — от 1 до 20 или без ограничения",
      );
  });

  it("попытки есть только у теста", () => {
    expect(pickActivityFields("quiz", { title: "Т", maxAttempts: 2 })).toEqual({
      title: "Т",
      maxAttempts: 2,
    });
    expect(pickActivityFields("assignment", { title: "З", maxAttempts: 2 })).not.toHaveProperty(
      "maxAttempts",
    );
  });
});
