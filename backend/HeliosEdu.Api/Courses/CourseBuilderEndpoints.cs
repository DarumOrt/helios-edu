using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Courses;

public static class CourseBuilderEndpoints
{
    public static void MapCourseBuilderEndpoints(this WebApplication app)
    {
        var course = app.MapGroup("/api/courses/{id}").RequireAuthorization(AccessRules.EditCourse)
            .AddEndpointFilter<ManagementWriteFilter>().AddEndpointFilter<CourseEditorFilter>();
        course.MapPost("/sections", AddSectionAsync);
        course.MapPatch("/sections/{sectionId}", RenameSectionAsync);
        course.MapDelete("/sections/{sectionId}", DeleteSectionAsync);
        course.MapPut("/sections/order", OrderSectionsAsync);
        course.MapPost("/sections/{sectionId}/activities", AddActivityAsync);
        course.MapPut("/sections/{sectionId}/activities/order", OrderActivitiesAsync);
        course.MapPatch("/activities/{activityId}", UpdateActivityAsync);
        course.MapDelete("/activities/{activityId}", DeleteActivityAsync);
    }

    private static Course Current(HttpContext context) => (Course)context.Items[typeof(Course)]!;
    private static string NewId(string prefix, IEnumerable<string> used)
    {
        string id;
        do { id = $"{prefix}-{Guid.NewGuid().ToString("N")[..8]}"; } while (used.Contains(id));
        return id;
    }
    private static Dictionary<string, string> SectionErrors(string? title) => (title?.Length ?? 0) is < 2 or > 120
        ? new() { ["title"] = "Название модуля — от 2 до 120 символов" } : new();
    private static void Renumber(Course course)
    {
        for (var i = 0; i < course.Sections.Count; i++) course.Sections[i].Order = i + 1;
    }
    private static void Positions(LearningDbContext db, Section section)
    {
        for (var i = 0; i < section.Activities.Count; i++) db.Entry(section.Activities[i]).Property("Position").CurrentValue = i;
    }

    private static async Task<IResult> AddSectionAsync(HttpContext context, LearningDbContext db)
    {
        var input = await ManagementInput.ReadAsync(context.Request);
        var errors = SectionErrors(input?.Text("title"));
        if (errors.Count > 0) return Invalid(errors);
        var course = Current(context);
        var section = new Section { Id = NewId("s", course.Sections.Select(section => section.Id)), Title = input!.Text("title"),
            Order = course.Sections.Count + 1 };
        course.Sections.Add(section);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Json(section, statusCode: 201);
    }

    private static async Task<IResult> RenameSectionAsync(string sectionId, HttpContext context, LearningDbContext db)
    {
        var input = await ManagementInput.ReadAsync(context.Request);
        var errors = SectionErrors(input?.Text("title"));
        if (errors.Count > 0) return Invalid(errors);
        var section = Current(context).Sections.Find(section => section.Id == sectionId);
        if (section is null) return Fail(404, "not found");
        section.Title = input!.Text("title");
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(section);
    }

    private static async Task<IResult> DeleteSectionAsync(string sectionId, HttpContext context, LearningDbContext db)
    {
        var course = Current(context);
        var section = course.Sections.Find(section => section.Id == sectionId);
        if (section is null) return Fail(404, "not found");
        if (section.Activities.Count > 0) return Fail(409, "В модуле есть материалы — сначала удалите или перенесите их");
        course.Sections.Remove(section);
        Renumber(course);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }

    private static async Task<IResult> OrderSectionsAsync(HttpContext context, LearningDbContext db)
    {
        var course = Current(context);
        var ids = ContentInput.Order(await ManagementInput.ReadAsync(context.Request), "sectionIds", course.Sections.Select(section => section.Id));
        if (ids is null) return Fail(400, "Передайте все модули курса по одному разу", new() { ["sectionIds"] = "Неверный порядок модулей" });
        course.Sections.Sort((left, right) => Array.IndexOf(ids, left.Id).CompareTo(Array.IndexOf(ids, right.Id)));
        Renumber(course);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(course.Sections);
    }

    private static async Task<IResult> AddActivityAsync(string sectionId, HttpContext context, LearningDbContext db)
    {
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var type = input.Choice("type");
        if (!ContentInput.IsType(type)) return Invalid(new() { ["type"] = "Выберите тип материала" });
        var values = new ContentInput(type, input, false);
        var errors = values.Validate(type, false);
        if (errors.Count > 0) return Invalid(errors);
        var course = Current(context);
        var section = course.Sections.Find(section => section.Id == sectionId);
        if (section is null) return Fail(404, "not found");
        var activity = new Activity { Id = NewId("a", course.Sections.SelectMany(section => section.Activities).Select(activity => activity.Id)),
            Type = type, Title = "" };
        values.Apply(activity);
        section.Activities.Add(activity);
        // Сначала DetectChanges устанавливает owned-ключи у новых сущностей.
        db.ChangeTracker.DetectChanges();
        Positions(db, section);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Json(activity, statusCode: 201);
    }

    private static async Task<IResult> OrderActivitiesAsync(string sectionId, HttpContext context, LearningDbContext db)
    {
        var section = Current(context).Sections.Find(section => section.Id == sectionId);
        var ids = ContentInput.Order(await ManagementInput.ReadAsync(context.Request), "activityIds", section?.Activities.Select(activity => activity.Id) ?? []);
        if (section is null) ids = null;
        if (ids is null) return Fail(400, "Передайте все материалы модуля по одному разу", new() { ["activityIds"] = "Неверный порядок материалов" });
        section!.Activities.Sort((left, right) => Array.IndexOf(ids, left.Id).CompareTo(Array.IndexOf(ids, right.Id)));
        Positions(db, section);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(section.Activities);
    }

    private static async Task<IResult> UpdateActivityAsync(string activityId, HttpContext context, LearningDbContext db)
    {
        var course = Current(context);
        var from = course.Sections.Find(section => section.Activities.Any(activity => activity.Id == activityId));
        var activity = from?.Activities.Find(activity => activity.Id == activityId);
        if (activity is null || from is null) return Fail(404, "not found");
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        if (input.Has("type") && input.Choice("type") != activity.Type)
            return Fail(400, "Тип материала изменить нельзя", new() { ["type"] = "Тип материала изменить нельзя" });
        // Старые file/forum/page остаются читаемыми и удаляемыми; редактор поддерживает пять типов.
        if (!ContentInput.IsType(activity.Type)) return Invalid(new() { ["type"] = "Выберите тип материала" });
        var values = new ContentInput(activity.Type, input, true);
        var errors = values.Validate(activity.Type, true);
        if (errors.Count > 0) return Invalid(errors);
        // Как в updateActivity мока: пустой или нестроковый sectionId не переносит материал.
        var sectionId = input.Value("sectionId") is { ValueKind: System.Text.Json.JsonValueKind.String } raw ? raw.GetString() : null;
        var to = string.IsNullOrEmpty(sectionId) ? from : course.Sections.Find(section => section.Id == sectionId);
        if (to is null) return Fail(400, "Такого модуля нет", new() { ["sectionId"] = "Такого модуля нет" });
        if (to != from)
        {
            // SectionId входит в owned-ключ: создаём копию вместо изменения владельца tracked-сущности.
            var moved = new Activity { Id = activity.Id, Type = activity.Type, Title = activity.Title,
                Src = activity.Src, Pages = activity.Pages, DurationMin = activity.DurationMin,
                Description = activity.Description, MaxGrade = activity.MaxGrade, Due = activity.Due, Completed = activity.Completed };
            from.Activities.Remove(activity);
            to.Activities.Add(moved);
            db.ChangeTracker.DetectChanges();
            Positions(db, from);
            Positions(db, to); // Перенос — в конец целевого модуля, как в моке.
            activity = moved;
        }
        values.Apply(activity);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(activity);
    }

    private static async Task<IResult> DeleteActivityAsync(string activityId, HttpContext context, LearningDbContext db)
    {
        var course = Current(context);
        var section = course.Sections.Find(section => section.Activities.Any(activity => activity.Id == activityId));
        var activity = section?.Activities.Find(activity => activity.Id == activityId);
        if (section is null || activity is null) return Fail(404, "not found");
        section.Activities.Remove(activity);
        Positions(db, section);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }
}

public sealed class CourseEditorFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var db = http.RequestServices.GetRequiredService<LearningDbContext>();
        var id = http.Request.RouteValues["id"]?.ToString();
        // Блокировка корня курса сериализует перестановки, добавления и переносы в одной транзакции.
        var lockedId = await db.Database.SqlQuery<string>($"SELECT \"Id\" AS \"Value\" FROM \"Courses\" WHERE \"Id\" = {id} FOR UPDATE")
            .SingleOrDefaultAsync(http.RequestAborted);
        if (lockedId is null) return Fail(404, "not found");
        var course = await db.Courses.Include(course => course.Sections.OrderBy(section => section.Order))
            .ThenInclude(section => section.Activities.OrderBy(activity => EF.Property<int>(activity, "Position")))
            .AsSplitQuery().SingleAsync(course => course.Id == lockedId, http.RequestAborted);
        var actor = (Account)http.Items[typeof(Account)]!;
        if (!AccessRules.CanEditCourse(actor, course)) return Fail(404, "not found");
        http.Items[typeof(Course)] = course;
        return await next(context);
    }
}
