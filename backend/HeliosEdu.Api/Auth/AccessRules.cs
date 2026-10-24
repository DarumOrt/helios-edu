using System.Security.Claims;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;

namespace HeliosEdu.Api.Auth;

public static class AccessRules
{
    public const string ManageUsers = "user.manage";
    public const string ManageCohorts = "cohort.manage";
    public const string ReadCohorts = "cohort.read";
    public const string ManageCourses = "course.manage";

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
        // Эталон — visibleDemoCourses: старый Enrollment не обходит группу и статус.
        return db.Courses.Where(course => course.Status == "published" && db.CohortCourses.Any(link =>
            link.CourseId == course.Id && db.Cohorts.Any(cohort => cohort.Id == link.CohortId &&
                db.Accounts.Any(account => account.Id == accountId && account.Role == "student" &&
                    account.TenantId == cohort.TenantId && account.Group == cohort.Name))));
    }
}
