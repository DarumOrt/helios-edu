using HeliosEdu.Api.Audit;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Management;

public sealed record FacultyInfo(string Code, string Name, bool Archived);
public sealed record FacultyUsage(int Users, int Cohorts, int Courses, int Organizers);

public static partial class ManagementEndpoints
{
    private static void MapFaculties(WebApplication app)
    {
        var routes = app.MapGroup("/api/faculties").RequireAuthorization().AddEndpointFilter<ManagementWriteFilter>();
        routes.MapGet("", async (HttpContext http, LearningDbContext db) =>
            await db.Faculties.Where(f => f.TenantId == Actor(http).TenantId &&
                (db.OrganizerId == null || db.ManagedFaculties.Contains(f.Code)))
                .OrderBy(f => f.Name).Select(f => new FacultyInfo(f.Code, f.Name, f.Archived)).ToListAsync(http.RequestAborted))
            .Produces<FacultyInfo[]>();
        routes.MapPost("", CreateFaculty).RequireAuthorization(AccessRules.ManageSystem).Produces<FacultyInfo>(201);
        routes.MapPatch("/{code}", UpdateFaculty).RequireAuthorization(AccessRules.ManageSystem).Produces<FacultyInfo>();
        routes.MapDelete("/{code}", DeleteFaculty).RequireAuthorization(AccessRules.ManageSystem);
    }

    private static Task<Faculty?> LockedFaculty(LearningDbContext db, string tenant, string code, CancellationToken token) =>
        db.Faculties.FromSqlInterpolated($"SELECT * FROM \"Faculties\" WHERE \"TenantId\" = {tenant} AND \"Code\" = {code} FOR UPDATE")
            .SingleOrDefaultAsync(token);

    private static async Task<IResult> CreateFaculty(HttpContext http, LearningDbContext db)
    {
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var code = input.Text("code");
        var name = input.Text("name");
        if (code.Length is < 1 or > 50 || !code.All(c => char.IsLetterOrDigit(c) || c is ' ' or '-'))
            return Fail(400, "Код факультета — до 50 символов, буквы, цифры, пробел или дефис");
        if (name.Length is < 2 or > 180) return Fail(400, "Название — от 2 до 180 символов");
        var faculty = new Faculty { TenantId = Actor(http).TenantId, Code = code, NormalizedCode = code.ToUpperInvariant(), Name = name };
        db.Faculties.Add(faculty);
        AuditLog.Write(db, http, "faculty.created", "faculty", code, name);
        await db.SaveChangesAsync(http.RequestAborted);
        return Results.Json(new FacultyInfo(code, name, false), statusCode: 201);
    }

    private static async Task<IResult> UpdateFaculty(string code, HttpContext http, LearningDbContext db)
    {
        var faculty = await LockedFaculty(db, Actor(http).TenantId, code, http.RequestAborted);
        if (faculty is null) return Fail(404, "Факультет не найден");
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input is null || input.Keys.Any(k => k is not ("name" or "archived"))) return Fail(400, "Некорректный запрос");
        var name = input.Has("name") ? input.Text("name") : faculty.Name;
        if (name.Length is < 2 or > 180) return Fail(400, "Название — от 2 до 180 символов");
        if (input.Has("archived") && input.Value("archived")?.ValueKind is not
            (System.Text.Json.JsonValueKind.True or System.Text.Json.JsonValueKind.False)) return Fail(400, "Некорректный статус");
        var archived = input.Value("archived")?.GetBoolean() ?? faculty.Archived;
        var changes = AuditLog.Diff(("Название", faculty.Name, name), ("В архиве", faculty.Archived ? "Да" : "Нет", archived ? "Да" : "Нет"));
        faculty.Name = name;
        faculty.Archived = archived;
        if (changes.Count > 0) AuditLog.Write(db, http, "faculty.updated", "faculty", code, name, changes);
        await db.SaveChangesAsync(http.RequestAborted);
        return Results.Ok(new FacultyInfo(code, name, archived));
    }

    private static async Task<IResult> DeleteFaculty(string code, HttpContext http, LearningDbContext db)
    {
        var tenant = Actor(http).TenantId;
        var token = http.RequestAborted;
        var faculty = await LockedFaculty(db, tenant, code, token);
        if (faculty is null) return Fail(404, "Факультет не найден");
        if (await db.CatalogCollectionFaculties.AnyAsync(link => link.TenantId == tenant && link.FacultyCode == code, token))
            return Fail(409, "Факультет используется в межфакультетском разделе. Уберите его из раздела или отправьте в архив.");
        var usage = new FacultyUsage(await db.Accounts.CountAsync(a => a.Faculty == code, token),
            await db.Cohorts.CountAsync(g => g.Faculty == code, token), await db.Courses.CountAsync(c => c.Faculty == code, token),
            await db.Accounts.CountAsync(a => a.OrganizerFaculties != null && a.OrganizerFaculties.Contains(code), token));
        if (usage != new FacultyUsage(0, 0, 0, 0))
            return Fail(409, $"Пользователей: {usage.Users}, групп: {usage.Cohorts}, курсов: {usage.Courses}, назначений организаторов: {usage.Organizers}. Перенесите их или отправьте факультет в архив.");
        db.Faculties.Remove(faculty);
        AuditLog.Write(db, http, "faculty.deleted", "faculty", code, faculty.Name);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task ValidateFaculty(HttpContext http, LearningDbContext db, string? code,
        Dictionary<string, string> fields, string? previous = null)
    {
        if (fields.ContainsKey("faculty")) return;
        if (db.OrganizerId != null && !db.ManagedFaculties.Contains(code))
        {
            fields["faculty"] = "Выберите один из назначенных факультетов";
            return;
        }
        if (code == null || code == previous) return;
        var faculty = await LockedFaculty(db, Actor(http).TenantId, code, http.RequestAborted);
        if (faculty is null || faculty.Archived) fields["faculty"] = "Выберите факультет из списка";
    }

    private static async Task<IResult?> ApplyOrganizerScope(HttpContext http, LearningDbContext db, ManagementInput input,
        Account account, string role)
    {
        if (!input.Has("organizerFaculties"))
        {
            if (role != "organizer") account.OrganizerFaculties = null;
            return null;
        }
        if (Actor(http).Role != "admin" || role != "organizer") return Fail(403, "Полномочия организатора назначает администратор");
        var codes = input.Ids("organizerFaculties");
        if (input.Value("organizerFaculties")?.ValueKind != System.Text.Json.JsonValueKind.Null)
        {
            if (codes is not { Length: > 0 and <= 200 }) return Fail(400, "Выберите хотя бы один факультет");
            foreach (var code in codes.Order())
            {
                var f = await LockedFaculty(db, Actor(http).TenantId, code, http.RequestAborted);
                if (f == null || f.Archived && account.OrganizerFaculties?.Contains(code) != true)
                    return Fail(400, "Выберите действующие факультеты");
            }
        }
        var changes = AuditLog.Diff(("Полномочия", account.OrganizerFaculties == null ? "Весь вуз" : string.Join(", ", account.OrganizerFaculties),
            codes == null ? "Весь вуз" : string.Join(", ", codes)));
        if (changes.Count > 0) AuditLog.Write(db, http, "user.updated", "user", account.Id, account.Name, changes);
        account.OrganizerFaculties = codes;
        return null;
    }
}
