import { describe, expect, it } from "vitest";
import { bkt } from "./adaptive-store";

// Демо-движок обязан считать так же, как AdaptiveEngine.Bkt в C#. Ожидаемые числа сняты с C# API.
const skill = { pInit: 0.3, pLearn: 0.15, pSlip: 0.1, pGuess: 0.2 } as Parameters<typeof bkt>[1];

describe("BKT — пересчёт освоения навыка", () => {
  it("верный ответ «верно/неверно» без подсказки: 0.3 → 0.5202 (как в C#)", () => {
    expect(bkt(0.3, skill, { type: "boolean", options: [] }, true, 0)).toBe(0.5202);
  });

  it("угадать из 4 вариантов труднее — рост больше: 0.3 → 0.6657", () => {
    expect(bkt(0.3, skill, { type: "mcq", options: ["а", "б", "в", "г"] }, true, 0)).toBe(0.6657);
  });

  it("ответ с подсказкой считается как ошибка и не повышает освоение", () => {
    const hinted = bkt(0.5, skill, { type: "boolean", options: [] }, true, 1);
    const wrong = bkt(0.5, skill, { type: "boolean", options: [] }, false, 0);
    expect(hinted).toBe(wrong);
    expect(hinted).toBeLessThan(0.5);
  });

  it("серия верных коротких ответов доводит навык до освоения (≥ 0.95)", () => {
    let p = skill.pInit;
    for (let i = 0; i < 3; i++) p = bkt(p, skill, { type: "short", options: [] }, true, 0);
    expect(p).toBeGreaterThanOrEqual(0.95);
  });
});
