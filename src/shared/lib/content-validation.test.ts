import { describe, expect, it } from "vitest";
import { pickActivityFields, validateQuestions } from "./content-validation";

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
