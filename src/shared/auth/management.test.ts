import { describe, expect, it } from "vitest";
import { MANAGED_COURSE_FIELDS, assignableRoles, canEditCourse, canManageUser, isSelf } from "./management";

describe("правила управления (зеркало AccessRules.cs)", () => {
  it("организатор не назначает администратора", () => {
    expect(assignableRoles("admin")).toContain("admin");
    expect(assignableRoles("organizer")).not.toContain("admin");
    expect(assignableRoles("tutor")).toEqual([]);
  });

  it("организатор не трогает администраторов", () => {
    expect(canManageUser({ role: "organizer" }, { role: "admin" })).toBe(false);
    expect(canManageUser({ role: "organizer" }, { role: "student" })).toBe(true);
    expect(canManageUser({ role: "admin" }, { role: "admin" })).toBe(true);
    expect(canManageUser({ role: "tutor" }, { role: "student" })).toBe(false);
  });

  it("преподаватель правит только свой курс", () => {
    const course = { tutorId: "u-tutor-1" };
    expect(canEditCourse({ id: "u-tutor-1", role: "tutor" }, course)).toBe(true);
    expect(canEditCourse({ id: "u-tutor-2", role: "tutor" }, course)).toBe(false);
    expect(canEditCourse({ id: "u-org", role: "organizer" }, course)).toBe(true);
    expect(canEditCourse({ id: "u-stud-1", role: "student" }, course)).toBe(false);
  });

  it("преподаватель не меняет преподавателя, факультет и год курса (CourseEndpoints.ManagedCourseFields)", () => {
    expect([...MANAGED_COURSE_FIELDS]).toEqual(["tutorId", "faculty", "academicYear"]);
  });

  it("isSelf сравнивает по id", () => {
    expect(isSelf({ id: "a" }, { id: "a" })).toBe(true);
    expect(isSelf({ id: "a" }, { id: "b" })).toBe(false);
  });
});
