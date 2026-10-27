using System.Security.Claims;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Courses;

// Поиск курсов: опубликованные курсы вуза для всех ролей. Материалы не отдаются —
// только карточка и список модулей; Accessible = курс открывается пользователю целиком.
public sealed record CatalogTutor(string Id, string Name);
public sealed record CatalogCohort(string Id, string Name, int? Year, string? Level,
    string? DirectionCode, string? Direction, string? Profile);
public sealed record CatalogSection(string Title, int Activities);
public sealed record CatalogCourse(string Id, string Code, string Title, string Description, string? Cover,
    string? CoverColor, string Category, string? Faculty, string? AcademicYear, CatalogTutor Tutor,
    IReadOnlyList<CatalogCohort> Cohorts, IReadOnlyList<CatalogSection> Sections, bool Accessible);

public static class CatalogEndpoints
{
    public static void MapCatalogEndpoints(this WebApplication app)
    {
        app.MapGet("/api/catalog", async (LearningDbContext db, HttpContext context, CancellationToken token) =>
        {
            var accountId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            var tenant = await db.Accounts.Where(account => account.Id == accountId)
                .Select(account => account.TenantId).SingleAsync(token);
            var courses = await db.Courses.AsNoTracking().AsSplitQuery()
                .Where(course => course.Status == "published")
                .Include(course => course.Sections.OrderBy(section => section.Order))
                .ThenInclude(section => section.Activities)
                .OrderBy(course => EF.Property<int>(course, "Position"))
                .ToListAsync(token);
            var ids = courses.Select(course => course.Id).ToList();
            var tutorIds = courses.Select(course => course.TutorId).Distinct().ToList();
            var tutors = await db.Accounts.Where(account => tutorIds.Contains(account.Id))
                .ToDictionaryAsync(account => account.Id, account => account.Name, token);
            var links = await (from link in db.CohortCourses
                               join cohort in db.Cohorts on link.CohortId equals cohort.Id
                               where ids.Contains(link.CourseId) && cohort.TenantId == tenant
                               orderby cohort.Name
                               select new { link.CourseId, Cohort = new CatalogCohort(cohort.Id, cohort.Name, cohort.Year,
                                   cohort.Level, cohort.DirectionCode, cohort.Direction, cohort.Profile) })
                .ToListAsync(token);
            var accessible = (await AccessRules.VisibleCourses(db, context.User)
                .Where(course => ids.Contains(course.Id)).Select(course => course.Id).ToListAsync(token)).ToHashSet();
            return Results.Ok(courses.Select(course => new CatalogCourse(course.Id, course.Code, course.Title,
                course.Description, course.Cover, course.CoverColor, course.Category, course.Faculty, course.AcademicYear,
                new CatalogTutor(course.TutorId, tutors.GetValueOrDefault(course.TutorId, "")),
                links.Where(link => link.CourseId == course.Id).Select(link => link.Cohort).ToList(),
                course.Sections.OrderBy(section => section.Order)
                    .Select(section => new CatalogSection(section.Title, section.Activities.Count)).ToList(),
                accessible.Contains(course.Id))));
        }).RequireAuthorization();
    }
}
