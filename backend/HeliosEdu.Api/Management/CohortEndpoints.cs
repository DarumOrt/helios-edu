using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Management;

public static partial class ManagementEndpoints
{
    private static void MapCohorts(WebApplication app)
    {
        var cohorts = app.MapGroup("/api/cohorts").AddEndpointFilter<ManagementWriteFilter>();
        cohorts.MapGet("", async (HttpContext context, LearningDbContext db) =>
        {
            var groups = await db.Cohorts.Where(group => group.TenantId == Actor(context).TenantId)
                .OrderBy(group => group.Id).ToListAsync(context.RequestAborted);
            var result = new List<CohortInfo>();
            foreach (var group in groups) result.Add(await CohortResult(db, group, context.RequestAborted));
            return Results.Ok(result);
        }).RequireAuthorization(AccessRules.ReadCohorts).Produces<CohortInfo[]>();
        cohorts.MapGet("/{id}", async Task<IResult> (string id, HttpContext context, LearningDbContext db) =>
        {
            var group = await FindCohort(db, id, Actor(context).TenantId, false, context.RequestAborted);
            return group is null ? Fail(404, "not found") : Results.Ok(await CohortResult(db, group, context.RequestAborted));
        }).RequireAuthorization(AccessRules.ReadCohorts).Produces<CohortInfo>();
        cohorts.MapPost("", CreateCohortAsync).RequireAuthorization(AccessRules.ManageCohorts);
        cohorts.MapPatch("/{id}", UpdateCohortAsync).RequireAuthorization(AccessRules.ManageCohorts);
        cohorts.MapPut("/{id}/members", UpdateMembersAsync).RequireAuthorization(AccessRules.ManageCohorts);
        cohorts.MapDelete("/{id}", async Task<IResult> (string id, HttpContext context, LearningDbContext db) =>
        {
            var group = await FindCohort(db, id, Actor(context).TenantId, true, context.RequestAborted);
            if (group is null) return Fail(404, "not found");
            if (await db.Accounts.AnyAsync(user => user.TenantId == group.TenantId && user.Role == "student" && user.Group == group.Name,
                    context.RequestAborted))
                return Fail(409, "В группе есть студенты — сначала уберите их из группы");
            db.Cohorts.Remove(group);
            await db.SaveChangesAsync(context.RequestAborted);
            return Results.NoContent();
        }).RequireAuthorization(AccessRules.ManageCohorts);
    }

    private static Task<Cohort?> FindCohort(LearningDbContext db, string id, string tenant, bool locked, CancellationToken token) =>
        (locked
            ? db.Cohorts.FromSqlInterpolated($"SELECT * FROM \"Cohorts\" WHERE \"Id\" = {id} AND \"TenantId\" = {tenant} FOR UPDATE")
            : db.Cohorts.Where(group => group.Id == id && group.TenantId == tenant)).SingleOrDefaultAsync(token);

    private static async Task<CohortInfo> CohortResult(LearningDbContext db, Cohort group, CancellationToken token) => new(
        group.Id, group.Name, group.Faculty,
        await db.Accounts.Where(user => user.TenantId == group.TenantId && user.Role == "student" && user.Group == group.Name)
            .OrderBy(user => user.Id).Select(user => user.Id).ToListAsync(token),
        await db.CohortCourses.Where(link => link.CohortId == group.Id).OrderBy(link => link.Position)
            .Select(link => link.CourseId).ToListAsync(token),
        group.Year, group.Level, group.DirectionCode, group.Direction, group.Profile);

    private static async Task<IResult> CreateCohortAsync(HttpContext context, LearningDbContext db)
    {
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var fields = Cohort(input, false);
        if (fields.Count > 0) return Invalid(fields);
        var name = input.Text("name");
        var normalized = name.ToUpperInvariant();
        var tenant = Actor(context).TenantId;
        if (await db.Cohorts.AnyAsync(group => group.TenantId == tenant && group.NormalizedName == normalized, context.RequestAborted))
            return Duplicate("name", "Группа с таким названием уже есть");
        var group = new Cohort { Id = $"co-{Guid.NewGuid():N}", Name = name, NormalizedName = normalized,
            TenantId = tenant, Faculty = input.OptionalText("faculty") };
        db.Cohorts.Add(group);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Json(await CohortResult(db, group, context.RequestAborted), statusCode: 201);
    }

    private static async Task<IResult> UpdateCohortAsync(string id, HttpContext context, LearningDbContext db)
    {
        var group = await FindCohort(db, id, Actor(context).TenantId, true, context.RequestAborted);
        if (group is null) return Fail(404, "not found");
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var fields = Cohort(input, true);
        var courseIds = input.Ids("courseIds");
        if (input.Has("courseIds") && (courseIds is null ||
                await db.Courses.CountAsync(course => courseIds.Contains(course.Id), context.RequestAborted) != courseIds.Length))
            fields["courseIds"] = "Есть неизвестные курсы";
        if (fields.Count > 0) return Invalid(fields);
        if (input.Has("name"))
        {
            var name = input.Text("name");
            var normalized = name.ToUpperInvariant();
            if (await db.Cohorts.AnyAsync(other => other.TenantId == group.TenantId && other.Id != id && other.NormalizedName == normalized,
                    context.RequestAborted)) return Duplicate("name", "Группа с таким названием уже есть");
            await db.Accounts.Where(user => user.TenantId == group.TenantId && user.Role == "student" && user.Group == group.Name)
                .ExecuteUpdateAsync(setters => setters.SetProperty(user => user.Group, name), context.RequestAborted);
            group.Name = name;
            group.NormalizedName = normalized;
        }
        if (input.Has("faculty")) group.Faculty = input.OptionalText("faculty");
        if (courseIds is not null)
        {
            await db.CohortCourses.Where(link => link.CohortId == id).ExecuteDeleteAsync(context.RequestAborted);
            db.CohortCourses.AddRange(courseIds.Select((courseId, position) => new CohortCourse
                { CohortId = id, CourseId = courseId, Position = position }));
        }
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(await CohortResult(db, group, context.RequestAborted));
    }

    private static async Task<IResult> UpdateMembersAsync(string id, HttpContext context, LearningDbContext db)
    {
        var group = await FindCohort(db, id, Actor(context).TenantId, true, context.RequestAborted);
        if (group is null) return Fail(404, "not found");
        var input = await ManagementInput.ReadAsync(context.Request);
        var ids = input?.Ids("memberIds");
        if (ids is null) return Fail(400, "Некорректный запрос", new() { ["memberIds"] = "Передайте список id студентов" });
        var members = await db.Accounts.Where(user => user.TenantId == group.TenantId && ids.Contains(user.Id) && user.Role == "student")
            .ToListAsync(context.RequestAborted);
        if (members.Count != ids.Length)
            return Fail(400, "В группу можно добавить только студентов", new() { ["memberIds"] = "В группу можно добавить только студентов" });
        await db.Accounts.Where(user => user.TenantId == group.TenantId && user.Role == "student" && user.Group == group.Name && !ids.Contains(user.Id))
            .ExecuteUpdateAsync(setters => setters.SetProperty(user => user.Group, (string?)null), context.RequestAborted);
        foreach (var member in members) member.Group = group.Name;
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(await CohortResult(db, group, context.RequestAborted));
    }
}
