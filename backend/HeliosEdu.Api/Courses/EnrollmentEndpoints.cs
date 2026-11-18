using System.Security.Cryptography;
using System.Text;
using HeliosEdu.Api.Audit;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Courses;

// Индивидуальная запись дополняет назначение курса группе и не меняет учебную группу студента.
public sealed class CourseEnrollment
{
    public string CourseId { get; set; } = "";
    public string UserId { get; set; } = "";
    public string Source { get; set; } = "manual";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed record EnrolledStudent(string Id, string Name, string Email, string? Group, string[] Sources);
public sealed record EnrollmentInfo(bool KeyEnabled, IReadOnlyList<string> CohortIds, IReadOnlyList<EnrolledStudent> Students);

public static class EnrollmentEndpoints
{
    private static Account Actor(HttpContext context) => (Account)context.Items[typeof(Account)]!;
    private static string Hash(string keyword) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(keyword)));

    public static void MapEnrollmentEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/courses/{id}/enrollment").RequireAuthorization(AccessRules.EditCourse)
            .AddEndpointFilter<ManagementWriteFilter>();
        group.MapGet("", ListAsync).Produces<EnrollmentInfo>();
        group.MapGet("/students", SearchAsync).Produces<EnrolledStudent[]>();
        group.MapPut("/key", SetKeyAsync);
        group.MapPost("/students", AddStudentAsync);
        group.MapDelete("/students/{userId}", RemoveStudentAsync).Produces(StatusCodes.Status204NoContent);
        app.MapGroup("/api/courses").RequireAuthorization(AccessRules.EnrollSelf)
            .AddEndpointFilter<ManagementWriteFilter>().MapPost("/{id}/enroll", EnrollAsync)
            .RequireRateLimiting("enrollment");
    }

    private static async Task<Course?> Editable(string id, HttpContext context, LearningDbContext db, bool roster = false)
    {
        var course = await AccessRules.VisibleCourses(db, context.User).SingleOrDefaultAsync(c => c.Id == id, context.RequestAborted);
        return course != null && (roster || AccessRules.CanEditCourse(Actor(context), course)) ? course : null;
    }

    private static async Task<IResult> ListAsync(string id, HttpContext context, LearningDbContext db)
    {
        var course = await Editable(id, context, db, roster: true);
        if (course is null) return Fail(404, "not found");
        var token = context.RequestAborted;
        var tenant = Actor(context).TenantId;
        var assignedGroups = db.Cohorts.Where(g => g.TenantId == tenant && db.CohortCourses.Any(l =>
            l.CourseId == id && l.CohortId == g.Id));
        var cohortIds = await assignedGroups.Select(g => g.Id).ToListAsync(token);
        var students = await AccessRules.CourseStudents(db, id).Where(a => a.TenantId == tenant)
            .OrderBy(a => a.Name).Select(a => new
            {
                a.Id, a.Name, a.Email, a.Group,
                ViaGroup = assignedGroups.Any(g => g.Name == a.Group),
                Individual = db.CourseEnrollments.Where(l => l.CourseId == id && l.UserId == a.Id)
                    .Select(l => l.Source).FirstOrDefault()
            }).ToListAsync(token);
        return Results.Ok(new EnrollmentInfo(course.EnrollmentKeyHash is not null, cohortIds,
            students.Select(a => new EnrolledStudent(a.Id, a.Name, a.Email, a.Group,
                a.Individual is { } source ? (a.ViaGroup ? ["group", source] : [source]) : ["group"])).ToList()));
    }

    private static async Task<IResult> SearchAsync(string id, string? q, HttpContext context, LearningDbContext db)
    {
        if (await Editable(id, context, db) is null) return Fail(404, "not found");
        var query = q?.Trim() ?? "";
        if (query.Length is < 2 or > 100) return Results.Ok(Array.Empty<EnrolledStudent>());
        var tenant = Actor(context).TenantId;
        var lowered = query.ToLowerInvariant();
        var rows = await db.Accounts.AsNoTracking().Where(a => a.TenantId == tenant && a.Role == "student" &&
            a.Status == "active" && (a.Name.ToLower().Contains(lowered) || a.Email.ToLower().Contains(lowered)))
            .OrderBy(a => a.Name).Take(20).Select(a => new EnrolledStudent(a.Id, a.Name, a.Email, a.Group, Array.Empty<string>()))
            .ToListAsync(context.RequestAborted);
        return Results.Ok(rows);
    }

    private static async Task<IResult> SetKeyAsync(string id, HttpContext context, LearningDbContext db)
    {
        var course = await Editable(id, context, db);
        if (course is null) return Fail(404, "not found");
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null || !input.Has("keyword")) return Fail(400, "Некорректный запрос");
        var keyword = input.Text("keyword");
        if (input.Value("keyword") is not { ValueKind: System.Text.Json.JsonValueKind.Null } && keyword.Length is < 4 or > 64)
            return Invalid(new() { ["keyword"] = "Кодовое слово — от 4 до 64 символов" });
        course.EnrollmentKeyHash = keyword.Length == 0 ? null : Hash(keyword);
        AuditLog.Write(db, context, "course.updated", "course", id, $"{course.Code} · настройки самозаписи");
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(new { ok = true });
    }

    private static async Task<IResult> AddStudentAsync(string id, HttpContext context, LearningDbContext db)
    {
        var course = await Editable(id, context, db);
        if (course is null) return Fail(404, "not found");
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var userId = input.Text("userId");
        var tenant = Actor(context).TenantId;
        var student = await db.Accounts.SingleOrDefaultAsync(a => a.Id == userId && a.TenantId == tenant &&
            a.Role == "student" && a.Status == "active", context.RequestAborted);
        if (student is null) return Invalid(new() { ["userId"] = "Выберите действующего студента" });
        await Add(db, context, course, student, "manual");
        return Results.Ok(new { ok = true });
    }

    private static async Task<IResult> RemoveStudentAsync(string id, string userId, HttpContext context, LearningDbContext db)
    {
        var course = await Editable(id, context, db);
        if (course is null) return Fail(404, "not found");
        var token = context.RequestAborted;
        var tenant = Actor(context).TenantId;
        var student = await db.Accounts.Where(a => a.Id == userId && a.TenantId == tenant && a.Role == "student")
            .Select(a => a.Name).SingleOrDefaultAsync(token);
        if (student is null) return Fail(404, "not found");
        var removed = await db.CourseEnrollments.Where(l => l.CourseId == id && l.UserId == userId)
            .ExecuteDeleteAsync(token);
        if (removed > 0)
        {
            AuditLog.Write(db, context, "course.unenrolled", "course", id, $"{course.Code} · {student}");
            await db.SaveChangesAsync(token);
        }
        return Results.NoContent();
    }

    private static async Task<IResult> EnrollAsync(string id, HttpContext context, LearningDbContext db)
    {
        var actor = Actor(context);
        // Блокировка сериализует запись со сменой ключа и удалением курса.
        var course = await db.Courses.FromSqlInterpolated($"SELECT * FROM \"Courses\" WHERE \"Id\" = {id} FOR UPDATE")
            .SingleOrDefaultAsync(context.RequestAborted);
        if (course is null || course.DeletedAt is not null || course.Status != "published") return Fail(404, "not found");
        var tenant = await db.Accounts.Where(a => a.Id == course.TutorId).Select(a => a.TenantId).SingleOrDefaultAsync(context.RequestAborted);
        if (tenant != actor.TenantId) return Fail(404, "not found");
        if (await AccessRules.IsCourseStudent(db, actor, id, context.RequestAborted)) return Results.Ok(new { ok = true });
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        if (course.EnrollmentKeyHash is null) return Fail(403, "Самостоятельная запись на курс отключена");
        var keyword = input.Text("keyword");
        if (keyword.Length is < 4 or > 64 || !CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(Hash(keyword)), Encoding.ASCII.GetBytes(course.EnrollmentKeyHash)))
            return Invalid(new() { ["keyword"] = "Неверное кодовое слово" });
        await Add(db, context, course, actor, "self");
        return Results.Ok(new { ok = true });
    }

    private static async Task Add(LearningDbContext db, HttpContext context, Course course, Account student, string source)
    {
        var count = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "CourseEnrollments" ("CourseId", "UserId", "Source", "CreatedAt")
            VALUES ({course.Id}, {student.Id}, {source}, {DateTimeOffset.UtcNow}) ON CONFLICT DO NOTHING
            """, context.RequestAborted);
        if (count > 0)
            AuditLog.Write(db, context, "course.enrolled", "course", course.Id, $"{course.Code} · {student.Name}");
        await db.SaveChangesAsync(context.RequestAborted);
    }
}
