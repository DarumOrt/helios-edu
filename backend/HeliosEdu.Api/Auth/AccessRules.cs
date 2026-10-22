using System.Security.Claims;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;

namespace HeliosEdu.Api.Auth;

public static class AccessRules
{
    public const string ManageUsers = "user.manage";

    public static bool CanViewGroup(Account account, string group) =>
        account.Role != "student" || (!string.IsNullOrEmpty(account.Group) && account.Group == group);

    public static IQueryable<Course> VisibleCourses(LearningDbContext db, ClaimsPrincipal user)
    {
        if (user.IsInRole("admin") || user.IsInRole("organizer")) return db.Courses;
        var accountId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (user.IsInRole("tutor")) return db.Courses.Where(course => course.TutorId == accountId);
        return db.Courses.Where(course => db.Enrollments.Any(enrollment =>
            enrollment.AccountId == accountId && enrollment.CourseId == course.Id));
    }
}
