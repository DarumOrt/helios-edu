import { describe, expect, it } from "vitest";
import { MANAGED_COURSE_FIELDS, assignableRoles, canEditCourse, canManageUser, isSelf } from "./management";

describe("правила управления (зеркало AccessRules.cs)", () => {
  it("организатор назначает студента и преподавателя", () => {
    expect(assignableRoles("admin")).toContain("admin");
    expect(assignableRoles("organizer")).toEqual(["student", "tutor"]);
    expect(assignableRoles("tutor")).toEqual([]);
  });

  it("организатор управляет заявками и нижестоящими ролями, может редактировать себя", () => {
    expect(canManageUser({ role: "organizer" }, { role: "admin" })).toBe(false);
    expect(canManageUser({ role: "organizer" }, { role: "student" })).toBe(true);
    expect(canManageUser({ id: "o1", role: "organizer" }, { id: "o2", role: "organizer" })).toBe(false);
    expect(canManageUser({ id: "o1", role: "organizer" }, { id: "o1", role: "organizer" })).toBe(true);
    expect(canManageUser({ role: "organizer" }, {})).toBe(true);
    expect(canManageUser({ role: "admin" }, { role: "admin" })).toBe(true);
    expect(canManageUser({ role: "tutor" }, { role: "student" })).toBe(false);
  });

  it("организатор редактирует курсы назначенных факультетов", () => {
    const actor = { id: "o", role: "organizer" as const, organizerFaculties: ["МФ", "ФФ"] };
    expect(canEditCourse(actor, { tutorId: "t", faculty: "ФФ" })).toBe(true);
    expect(canEditCourse(actor, { tutorId: "t", faculty: "ИНЭК" })).toBe(false);
    expect(canEditCourse(actor, { tutorId: "t" })).toBe(false);
  });

  it("преподаватель правит только свой курс", () => {
    const course = { tutorId: "u-tutor-1" };
    expect(canEditCourse({ id: "u-tutor-1", role: "tutor" }, course)).toBe(true);
    expect(canEditCourse({ id: "u-tutor-2", role: "tutor" }, course)).toBe(false);
    expect(canEditCourse({ id: "u-org", role: "organizer" }, course)).toBe(true);
    expect(canEditCourse({ id: "u-stud-1", role: "student" }, course)).toBe(false);
  });

  it("преподаватель не меняет преподавателя, факультет и год курса (CourseEndpoints.ManagedCourseFields)", () => {
    expect([...MANAGED_COURSE_FIELDS]).toEqual(["tutorId", "academicYear"]);
    expect(MANAGED_COURSE_FIELDS).not.toContain("cohortIds");
  });

  it("isSelf сравнивает по id", () => {
    expect(isSelf({ id: "a" }, { id: "a" })).toBe(true);
    expect(isSelf({ id: "a" }, { id: "b" })).toBe(false);
  });
});
