using System.Security.Claims;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Auth;

public static class AccessRules
{
    /// <summary>
    /// Ученики курса — студенты групп, которым он назначен. Та же связь, что в VisibleCourses:
    /// курс в новой группе сразу доступен её студентам, после перевода в другую группу — нет.
    /// </summary>
    public static IQueryable<Account> CourseStudents(LearningDbContext db, string courseId) =>
        db.Accounts.Where(account => account.Role == "student" && db.CohortCourses.Any(link =>
            link.CourseId == courseId && db.Cohorts.Any(cohort => cohort.Id == link.CohortId &&
                cohort.TenantId == account.TenantId && cohort.Name == account.Group)));

    public static Task<bool> IsCourseStudent(LearningDbContext db, Account actor, string courseId, CancellationToken token) =>
        actor.Role == "student" ? CourseStudents(db, courseId).AnyAsync(account => account.Id == actor.Id, token) : Task.FromResult(false);
    public const string ManageUsers = "user.manage";
    public const string ManageCohorts = "cohort.manage";
    public const string ReadCohorts = "cohort.read";
    public const string ManageCourses = "course.manage";
    public const string EditCourse = "course.edit";
    /// <summary>настройки системы и журнал действий — только администратор</summary>
    public const string ManageSystem = "system.manage";

    public static bool CanEditCourse(Account actor, Course course) =>
        actor.Role is "admin" or "organizer" || actor.Role == "tutor" && course.TutorId == actor.Id;

    public static bool CanManageUser(Account actor, Account target) =>
        target.Role != "admin" || actor.Role == "admin";

    public static bool CanAssignRole(Account actor, string role) =>
        role != "admin" || actor.Role == "admin";

    public static bool CanViewGroup(Account account, string group) =>
        account.Role != "student" || (!string.IsNullOrEmpty(account.Group) && account.Group == group);

    public static IQueryable<Course> VisibleCourses(LearningDbContext db, ClaimsPrincipal user)
    {
        if (user.IsInRole("admin") || user.IsInRole("organizer")) return db.Courses;
        var accountId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (user.IsInRole("tutor")) return db.Courses.Where(course => course.TutorId == accountId);
        // Эталон — visibleDemoCourses.
        return db.Courses.Where(course => course.Status == "published" && db.CohortCourses.Any(link =>
            link.CourseId == course.Id && db.Cohorts.Any(cohort => cohort.Id == link.CohortId &&
                db.Accounts.Any(account => account.Id == accountId && account.Role == "student" &&
                    account.TenantId == cohort.TenantId && account.Group == cohort.Name))));
    }
}
