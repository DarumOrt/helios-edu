import { describe, expect, it } from "vitest";
import { actionForMockApi, can, navForRole } from "./permissions";
import type { Role } from "@/shared/types/domain";

const roles: Role[] = ["student", "tutor", "organizer", "admin"];

describe("can — матрица прав", () => {
  it("тест проходит и задание сдаёт только студент", () => {
    expect(roles.filter((r) => can(r, "quiz.take"))).toEqual(["student"]);
    expect(roles.filter((r) => can(r, "assignment.submit"))).toEqual(["student"]);
  });

  it("курсы создаёт управление, правит ещё и преподаватель", () => {
    expect(roles.filter((r) => can(r, "course.create"))).toEqual(["organizer", "admin"]);
    expect(roles.filter((r) => can(r, "course.edit"))).toEqual(["tutor", "organizer", "admin"]);
  });

  it("оценки ставят преподаватель и администратор, но не организатор", () => {
    expect(can("tutor", "grade.edit")).toBe(true);
    expect(can("admin", "grade.edit")).toBe(true);
    expect(can("organizer", "grade.edit")).toBe(false);
    expect(can("student", "grade.edit")).toBe(false);
  });

  it("настройки системы — только администратор", () => {
    expect(roles.filter((r) => can(r, "system.manage"))).toEqual(["admin"]);
  });
});

describe("navForRole — меню", () => {
  it("«Поиск» — первый пункт у всех ролей", () => {
    for (const role of roles) expect(navForRole(role)[0]).toMatchObject({ href: "/search", label: "Поиск" });
  });

  it("студент не видит администрирование и проверку работ", () => {
    const hrefs = navForRole("student").map((i) => i.href);
    expect(hrefs.some((h) => h.startsWith("/admin"))).toBe(false);
    expect(hrefs).not.toContain("/submissions");
  });

  it("настройки системы в меню только у администратора", () => {
    for (const role of roles)
      expect(navForRole(role).some((i) => i.href === "/admin/settings")).toBe(role === "admin");
  });
});

describe("actionForMockApi — права маршрутов на моках", () => {
  it("конструктор курса и обложка требуют course.edit", () => {
    expect(actionForMockApi("/api/courses/c-1/sections", "POST")).toBe("course.edit");
    expect(actionForMockApi("/api/courses/c-1/cover", "PUT")).toBe("course.edit");
  });

  it("объявления читают все участники, пишет преподаватель", () => {
    expect(actionForMockApi("/api/courses/c-1/announcements", "GET")).toBe("course.view");
    expect(actionForMockApi("/api/courses/c-1/announcements", "POST")).toBe("course.edit");
  });

  it("журнал действий проверяет C#, неизвестный путь закрыт", () => {
    // настройки и журнал проверяет C# (Audit/AuditEndpoints.cs) — proxy их пропускает
    expect(actionForMockApi("/api/audit", "GET")).toBeNull();
    // трекинг, аналитику, лидерборд и расписание тоже проверяет C# (Tracking/TrackingEndpoints.cs)
    for (const path of [
      "/api/tracking/progress",
      "/api/analytics/course/c-1",
      "/api/hub/leaderboard",
      "/api/schedule",
    ])
      expect(actionForMockApi(path, "GET")).toBeNull();
    expect(actionForMockApi("/api/unknown", "GET")).toBeNull();
  });
});
