using HeliosEdu.Api.Audit;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Courses;

public sealed record CatalogCollectionInfo(string Id, string Name, string[] FacultyCodes, string[] CourseIds);

public static class CatalogCollectionEndpoints
{
    public static void MapCatalogCollectionEndpoints(this WebApplication app)
    {
        var routes = app.MapGroup("/api/catalog-collections")
            .RequireAuthorization().AddEndpointFilter<ManagementWriteFilter>();
        routes.MapGet("", PublicAsync).Produces<CatalogCollectionInfo[]>();
        routes.MapGet("/manage", ManageAsync).RequireAuthorization(AccessRules.ManageSystem).Produces<CatalogCollectionInfo[]>();
        routes.MapPost("", (HttpContext context, LearningDbContext db) => SaveAsync(null, context, db))
            .RequireAuthorization(AccessRules.ManageSystem).Produces<CatalogCollectionInfo>(201);
        routes.MapPut("/{id}", SaveAsync).RequireAuthorization(AccessRules.ManageSystem).Produces<CatalogCollectionInfo>();
        routes.MapDelete("/{id}", DeleteAsync).RequireAuthorization(AccessRules.ManageSystem).Produces(204);
    }

    private static string Tenant(HttpContext context) => ((Account)context.Items[typeof(Account)]!).TenantId;

    private static IQueryable<CatalogCollection> WithLinks(IQueryable<CatalogCollection> source) =>
        source.AsSplitQuery().Include(item => item.Faculties).Include(item => item.Courses);

    private static CatalogCollectionInfo Info(CatalogCollection item) =>
        new(item.Id, item.Name, item.Faculties.Select(link => link.FacultyCode).Order().ToArray(),
            item.Courses.Select(link => link.CourseId).Order().ToArray());

    private static async Task<List<CatalogCollectionInfo>> ManageAsync(HttpContext context, LearningDbContext db, CancellationToken token)
    {
        var tenant = Tenant(context);
        var items = await WithLinks(db.CatalogCollections.AsNoTracking().Where(item => item.TenantId == tenant))
            .OrderBy(item => item.Name).ToListAsync(token);
        return items.Select(Info).ToList();
    }

    private static async Task<List<CatalogCollectionInfo>> PublicAsync(HttpContext context, LearningDbContext db, CancellationToken token)
    {
        // В проверочной копии нет каталога вуза. Старые проверочные схемы также не содержат этих таблиц.
        if (RolePreview.ContextKey(context) is not null) return [];
        var items = await ManageAsync(context, db, token);
        if (items.Count == 0) return [];

        var tenant = Tenant(context);
        var faculties = (await db.Faculties.Where(f => f.TenantId == tenant && !f.Archived)
            .Select(f => f.Code).ToListAsync(token)).ToHashSet();
        var linked = items.SelectMany(item => item.CourseIds).Distinct().ToArray();
        // Здесь те же ограничения каталога, включая область организатора. Доступ к материалам проверяется отдельно.
        var published = (await CatalogEndpoints.PublishedCourses(db).Where(c => linked.Contains(c.Id))
            .Select(c => c.Id).ToListAsync(token)).ToHashSet();

        return items.Select(item => item with
            {
                FacultyCodes = item.FacultyCodes.Where(faculties.Contains).ToArray(),
                CourseIds = item.CourseIds.Where(published.Contains).ToArray(),
            })
            .Where(item => item.FacultyCodes.Length >= 2 && item.CourseIds.Length > 0).ToList();
    }

    private static async Task<IResult> SaveAsync(string? id, HttpContext context, LearningDbContext db)
    {
        var token = context.RequestAborted;
        var tenant = Tenant(context);
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var name = input.Text("name");
        var normalizedName = name.ToUpperInvariant();
        var facultyCodes = input.Ids("facultyCodes");
        var courseIds = input.Ids("courseIds");
        var fields = new Dictionary<string, string>();

        if (name.Length is < 2 or > 120) fields["name"] = "Название должно содержать от 2 до 120 символов";
        if (facultyCodes is not { Length: >= 2 and <= 200 } || (await db.Faculties.FromSqlInterpolated($"""
            SELECT * FROM "Faculties" WHERE "TenantId" = {tenant} AND NOT "Archived" AND "Code" = ANY({facultyCodes})
            ORDER BY "Code" FOR SHARE
            """).AsNoTracking().ToListAsync(token)).Count != facultyCodes.Length)
            fields["facultyCodes"] = "Выберите от 2 до 200 действующих факультетов";
        if (courseIds is not { Length: <= 200 } || await db.Courses.CountAsync(
            c => c.TenantId == tenant && c.DeletedAt == null && courseIds.Contains(c.Id), token) != courseIds.Length)
            fields["courseIds"] = "Выберите до 200 существующих курсов";
        if (fields.Count > 0) return Invalid(fields);

        var item = id is null
            ? new CatalogCollection { Id = Guid.NewGuid().ToString("N"), TenantId = tenant }
            : await LockedAsync(db, tenant, id, token);
        if (item is null) return Fail(404, "Раздел не найден");
        var before = Info(item);
        item.Name = name;
        item.NormalizedName = normalizedName;
        item.Faculties.RemoveAll(link => !facultyCodes!.Contains(link.FacultyCode));
        item.Courses.RemoveAll(link => !courseIds!.Contains(link.CourseId));
        foreach (var code in facultyCodes!.Except(item.Faculties.Select(link => link.FacultyCode)))
            item.Faculties.Add(new CatalogCollectionFaculty { TenantId = tenant, FacultyCode = code });
        foreach (var courseId in courseIds!.Except(item.Courses.Select(link => link.CourseId)))
            item.Courses.Add(new CatalogCollectionCourse { CourseId = courseId });
        if (id is null) db.CatalogCollections.Add(item);

        var after = Info(item);
        AuditLog.Write(db, context, id is null ? "catalog_collection.created" : "catalog_collection.updated",
            "catalog_collection", item.Id, name, AuditLog.Diff(
                ("Название", before.Name, name),
                ("Факультеты", string.Join(", ", before.FacultyCodes), string.Join(", ", after.FacultyCodes)),
                ("Курсы", string.Join(", ", before.CourseIds), string.Join(", ", after.CourseIds))));
        await db.SaveChangesAsync(token);
        return id is null ? Results.Json(after, statusCode: 201) : Results.Ok(after);
    }

    private static Task<CatalogCollection?> LockedAsync(LearningDbContext db, string tenant, string id, CancellationToken token) =>
        WithLinks(db.CatalogCollections.FromSqlInterpolated(
            $"SELECT * FROM \"CatalogCollections\" WHERE \"TenantId\" = {tenant} AND \"Id\" = {id} FOR UPDATE"))
            .SingleOrDefaultAsync(token);

    private static async Task<IResult> DeleteAsync(string id, HttpContext context, LearningDbContext db)
    {
        var item = await LockedAsync(db, Tenant(context), id, context.RequestAborted);
        if (item is null) return Fail(404, "Раздел не найден");
        db.CatalogCollections.Remove(item);
        AuditLog.Write(db, context, "catalog_collection.deleted", "catalog_collection", item.Id, item.Name);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }
}
