import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_CATEGORIES } from "./audit-labels";

// Список действий журнала живёт в двух местах (C# пишет, интерфейс фильтрует) — сверяем их.
const csharp = readFileSync("backend/HeliosEdu.Api/Audit/AuditLog.cs", "utf8");
const fromCsharp = Object.fromEntries(
  [...csharp.matchAll(/\["([a-z_.]+)"\] = \("([^"]+)", "([a-z]+)"\)/g)].map(([, code, text, category]) => [
    code,
    [text, category],
  ]),
);

describe("действия журнала (зеркало AuditLog.Actions в C#)", () => {
  it("те же коды, тексты и разделы, что в C#", () => {
    expect(Object.keys(fromCsharp).length).toBeGreaterThan(30);
    expect(AUDIT_ACTIONS).toEqual(fromCsharp);
  });

  it("у каждого раздела есть подпись фильтра", () => {
    const labelled = new Set(AUDIT_CATEGORIES.map((c) => c.value));
    for (const [, category] of Object.values(AUDIT_ACTIONS)) expect(labelled).toContain(category);
  });
});
