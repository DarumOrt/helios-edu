using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Management;

public sealed record DirectoryUser(string Id, string Name, string Email, string TenantId,
    string? Role, string Status, string? Faculty, string? Group, DateTimeOffset? CreatedAt, string[]? OrganizerFaculties);

public sealed record UserDirectory(IReadOnlyList<DirectoryUser> Items, int Total, int Page, int PageSize,
    int PendingCount, IReadOnlyList<string> Faculties, IReadOnlyList<string> Groups);

public sealed record DirectoryCohort(string Id, string Name, string? Faculty, int? Year, int Students, int Courses);

public sealed record CohortDirectory(IReadOnlyList<DirectoryCohort> Items, int Total, int Page, int PageSize,
    IReadOnlyList<string> Faculties, IReadOnlyList<int> Years);

public static partial class ManagementEndpoints
{
    private const int DirectoryPageSize = 25;
    private static int DirectoryPage(int? requested, int total) =>
        Math.Clamp(requested ?? 1, 1, Math.Max(1, (total - 1) / DirectoryPageSize + 1));

    private static string SearchPattern(string query) =>
        $"%{query.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";

    private static async Task<IResult> UserDirectoryAsync(HttpContext context, LearningDbContext db, string? q,
        string? role, string? status, string? faculty, string? group, bool? ungrouped, string? sort, int? page)
    {
        var tenant = Actor(context).TenantId;
        var token = context.RequestAborted;
        var users = db.Accounts.AsNoTracking().Where(user => user.TenantId == tenant && user.Status != "deleted");
        var pendingCount = await users.CountAsync(user => user.Status == Account.Pending, token);
        var faculties = await users.Where(user => user.Faculty != null).Select(user => user.Faculty!)
            .Distinct().OrderBy(f => f).ToListAsync(token);
        var groups = await db.Cohorts.AsNoTracking().Where(c => c.TenantId == tenant)
            .Select(c => c.Name).OrderBy(name => name).ToListAsync(token);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = SearchPattern(q);
            users = users.Where(user => EF.Functions.ILike(user.Name, pattern) ||
                EF.Functions.ILike(user.Email, pattern) || user.Group != null && EF.Functions.ILike(user.Group, pattern));
        }
        if (!string.IsNullOrEmpty(role)) users = users.Where(user => user.Role == role);
        if (!string.IsNullOrEmpty(status)) users = users.Where(user => user.Status == status);
        if (!string.IsNullOrEmpty(faculty)) users = users.Where(user => user.Faculty == faculty);
        if (ungrouped == true) users = users.Where(user => user.Group == null || user.Group == "");
        else if (!string.IsNullOrEmpty(group)) users = users.Where(user => user.Group == group);
        var total = await users.CountAsync(token);
        var selectedPage = DirectoryPage(page, total);
        var ordered = sort switch
        {
            "name-desc" => users.OrderByDescending(user => user.Name),
            "newest" => users.OrderBy(user => user.CreatedAt == null).ThenByDescending(user => user.CreatedAt)
                .ThenBy(user => user.Name),
            "oldest" => users.OrderBy(user => user.CreatedAt == null).ThenBy(user => user.CreatedAt)
                .ThenBy(user => user.Name),
            _ => users.OrderBy(user => user.Name)
        };
        var items = await ordered.ThenBy(user => user.Id)
            .Skip((selectedPage - 1) * DirectoryPageSize).Take(DirectoryPageSize)
            .Select(user => new DirectoryUser(user.Id, user.Name, user.Email, user.TenantId,
                user.Status == Account.Pending ? null : user.Role, user.Status, user.Faculty, user.Group, user.CreatedAt, user.OrganizerFaculties))
            .ToListAsync(token);
        return Results.Ok(new UserDirectory(items, total, selectedPage, DirectoryPageSize, pendingCount, faculties, groups));
    }

    private static async Task<IResult> CohortDirectoryAsync(HttpContext context, LearningDbContext db, string? q,
        string? faculty, int? year, string? occupancy, string? sort, int? page)
    {
        var tenant = Actor(context).TenantId;
        var token = context.RequestAborted;
        var groups = db.Cohorts.AsNoTracking().Where(group => group.TenantId == tenant);
        var faculties = await groups.Where(group => group.Faculty != null).Select(group => group.Faculty!)
            .Distinct().OrderBy(f => f).ToListAsync(token);
        var years = await groups.Where(group => group.Year != null).Select(group => group.Year!.Value)
            .Distinct().OrderBy(y => y).ToListAsync(token);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = SearchPattern(q);
            groups = groups.Where(group => EF.Functions.ILike(group.Name, pattern));
        }
        if (!string.IsNullOrEmpty(faculty)) groups = groups.Where(group => group.Faculty == faculty);
        if (year.HasValue) groups = groups.Where(group => group.Year == year);
        var rows = groups.Select(group => new
        {
            group.Id, group.Name, group.Faculty, group.Year,
            Students = db.Accounts.Count(user => user.TenantId == tenant && user.Role == "student" &&
                user.Status != "deleted" && user.Group == group.Name),
        });
        if (occupancy == "empty") rows = rows.Where(group => group.Students == 0);
        if (occupancy == "occupied") rows = rows.Where(group => group.Students > 0);
        var total = await rows.CountAsync(token);
        var selectedPage = DirectoryPage(page, total);
        var ordered = sort switch
        {
            "name-desc" => rows.OrderByDescending(group => group.Name),
            "most-students" => rows.OrderByDescending(group => group.Students).ThenBy(group => group.Name),
            "fewest-students" => rows.OrderBy(group => group.Students).ThenBy(group => group.Name),
            _ => rows.OrderBy(group => group.Name)
        };
        var items = await ordered.ThenBy(group => group.Id)
            .Skip((selectedPage - 1) * DirectoryPageSize).Take(DirectoryPageSize)
            .Select(group => new DirectoryCohort(group.Id, group.Name, group.Faculty, group.Year, group.Students,
                db.CohortCourses.Count(link => link.CohortId == group.Id &&
                    db.Courses.Any(course => course.Id == link.CourseId && course.DeletedAt == null))))
            .ToListAsync(token);
        return Results.Ok(new CohortDirectory(items, total, selectedPage, DirectoryPageSize, faculties, years));
    }
}
