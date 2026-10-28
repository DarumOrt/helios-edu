using HeliosEdu.Api.Audit;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Files;
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
        course.MapPut("/cover", UpdateCoverAsync).Produces<CourseSummary>();
        // корзина курса: удалённые модули и материалы — 7 дней, потом окончательно
        course.MapGet("/trash", (HttpContext context, LearningDbContext db) => CourseTrash.ListItemsAsync(context, db, Current(context)))
            .Produces<TrashItemInfo[]>();
        course.MapPost("/trash/{itemId}/restore", (string itemId, HttpContext context, LearningDbContext db) =>
            CourseTrash.RestoreItemAsync(itemId, context, db, Current(context), section => Positions(db, section)));
    }

    /// <summary>Загруженный файл материала — этого курса и нужного вида (видео — video, PDF и презентация — document).</summary>
    private static async Task<string?> SourceError(LearningDbContext db, ContentInput values, string type, string courseId,
        CancellationToken token) =>
        FileKinds.ForActivity(type) is { } kind
            ? await FilesEndpoints.CheckAttachedAsync(db, values.Src, courseId, kind, null, token)
            : null;

    /// <summary>
    /// PUT { coverColor?, cover? } — цвет шаблона и своя картинка обложки (загруженный файл вида cover, null — убрать).
    /// Старая картинка без ссылок уйдёт в корзину файлов сама (FileJanitor).
    /// </summary>
    private static async Task<IResult> UpdateCoverAsync(HttpContext context, LearningDbContext db)
    {
        var course = Current(context);
        var token = context.RequestAborted;
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var before = (course.CoverColor, course.Cover);
        if (input.Has("coverColor"))
        {
            // null — цвет по умолчанию (как у курсов из начальных данных)
            var color = input.OptionalText("coverColor");
            if (color is not null && !CoverColors.Contains(color))
                return Invalid(new() { ["coverColor"] = "Неизвестный цвет обложки" });
            course.CoverColor = color;
        }
        if (input.Has("cover"))
        {
            var cover = input.OptionalText("cover");
            if (cover is not null && (!cover.StartsWith(FilesEndpoints.UrlPrefix, StringComparison.Ordinal) ||
                    await FilesEndpoints.CheckAttachedAsync(db, cover, course.Id, FileKinds.Cover.Name, null, token) is not null))
                return Invalid(new() { ["cover"] = "Картинка не найдена — загрузите её ещё раз" });
            course.Cover = cover;
        }
        var changes = AuditLog.Diff(("Цвет", before.CoverColor, course.CoverColor), ("Картинка", before.Cover, course.Cover));
        if (changes.Count > 0) AuditLog.Write(db, context, "course.cover", "course", course.Id, Name(course, course.Title), changes);
        await db.SaveChangesAsync(token);
        var actor = (Account)context.Items[typeof(Account)]!;
        return Results.Ok(CourseSummary.From(course, (await CourseProgress.ForViewer(db, actor, [course.Id], token))[course.Id]));
    }

    private static Course Current(HttpContext context) => (Course)context.Items[typeof(Course)]!;
    private static string NewId(string prefix, IEnumerable<string> used)
    {
        string id;
        do { id = $"{prefix}-{Guid.NewGuid().ToString("N")[..8]}"; } while (used.Contains(id));
        return id;
    }
    private static string Name(Course course, string title) => $"{course.Code} · {title}";

    /// <summary>Поля материала для журнала («было → стало»): подпись и значение в читаемом виде.</summary>
    private static (string, string?)[] Fields(Activity activity, Section section) =>
    [
        ("Название", activity.Title), ("Модуль", section.Title), ("Файл или ссылка", activity.Src),
        ("Срок", activity.Due?.ToString("dd.MM.yyyy HH:mm 'UTC'", System.Globalization.CultureInfo.InvariantCulture)),
        ("Условие", activity.Description), ("Оценка из", activity.MaxGrade?.ToString()),
        ("Попыток", activity.MaxAttempts?.ToString()), ("Страниц", activity.Pages?.ToString()),
        ("Длительность, мин", activity.DurationMin?.ToString()),
    ];

    private static List<AuditChange> Compare((string, string?)[] before, (string, string?)[] after) =>
        AuditLog.Diff([.. before.Zip(after, (left, right) => (left.Item1, left.Item2, right.Item2))]);

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
        AuditLog.Write(db, context, "section.created", "section", section.Id, Name(course, section.Title));
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
        var changes = AuditLog.Diff(("Название", section.Title, input!.Text("title")));
        section.Title = input.Text("title");
        if (changes.Count > 0)
            AuditLog.Write(db, context, "section.renamed", "section", section.Id, Name(Current(context), section.Title), changes);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(section);
    }

    private static async Task<IResult> DeleteSectionAsync(string sectionId, HttpContext context, LearningDbContext db)
    {
        var course = Current(context);
        var section = course.Sections.Find(section => section.Id == sectionId);
        if (section is null) return Fail(404, "not found");
        if (section.Activities.Count > 0) return Fail(409, "В модуле есть материалы — сначала удалите или перенесите их");
        var skills = await db.Skills.Where(skill => skill.CourseId == course.Id && skill.SectionId == sectionId).ToListAsync(context.RequestAborted);
        var skillIds = skills.Select(skill => skill.Id).ToArray();
        if (await db.SkillMastery.AnyAsync(item => skillIds.Contains(item.SkillId), context.RequestAborted))
            return Fail(409, "По навыкам модуля уже есть результаты учеников");
        db.Skills.RemoveRange(skills);
        CourseTrash.TrashSection(db, context, course, section);
        course.Sections.Remove(section);
        Renumber(course);
        AuditLog.Write(db, context, "section.deleted", "section", section.Id, Name(course, section.Title));
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }

    private static async Task<IResult> OrderSectionsAsync(HttpContext context, LearningDbContext db)
    {
        var course = Current(context);
        var ids = ContentInput.Order(await ManagementInput.ReadAsync(context.Request), "sectionIds", course.Sections.Select(section => section.Id));
        if (ids is null) return Fail(400, "Передайте все модули курса по одному разу", new() { ["sectionIds"] = "Неверный порядок модулей" });
        var order = string.Join(" → ", course.Sections.Select(section => section.Title));
        course.Sections.Sort((left, right) => Array.IndexOf(ids, left.Id).CompareTo(Array.IndexOf(ids, right.Id)));
        Renumber(course);
        var changes = AuditLog.Diff(("Порядок", order, string.Join(" → ", course.Sections.Select(section => section.Title))));
        if (changes.Count > 0) AuditLog.Write(db, context, "section.reordered", "course", course.Id, Name(course, course.Title), changes);
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
        if (await SourceError(db, values, type, course.Id, context.RequestAborted) is { } sourceError)
            return Invalid(new() { ["src"] = sourceError });
        var activity = new Activity { Id = NewId("a", course.Sections.SelectMany(section => section.Activities).Select(activity => activity.Id)),
            Type = type, Title = "" };
        values.Apply(activity);
        section.Activities.Add(activity);
        // Сначала DetectChanges устанавливает owned-ключи у новых сущностей.
        db.ChangeTracker.DetectChanges();
        Positions(db, section);
        AuditLog.Write(db, context, "activity.created", "activity", activity.Id, Name(course, activity.Title),
            AuditLog.Diff([.. Fields(activity, section).Select(item => (item.Item1, (string?)null, item.Item2))]));
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Json(activity, statusCode: 201);
    }

    private static async Task<IResult> OrderActivitiesAsync(string sectionId, HttpContext context, LearningDbContext db)
    {
        var section = Current(context).Sections.Find(section => section.Id == sectionId);
        var ids = ContentInput.Order(await ManagementInput.ReadAsync(context.Request), "activityIds", section?.Activities.Select(activity => activity.Id) ?? []);
        if (section is null) ids = null;
        if (ids is null) return Fail(400, "Передайте все материалы модуля по одному разу", new() { ["activityIds"] = "Неверный порядок материалов" });
        var order = string.Join(" → ", section!.Activities.Select(activity => activity.Title));
        section.Activities.Sort((left, right) => Array.IndexOf(ids, left.Id).CompareTo(Array.IndexOf(ids, right.Id)));
        Positions(db, section);
        var changes = AuditLog.Diff(("Порядок", order, string.Join(" → ", section.Activities.Select(activity => activity.Title))));
        if (changes.Count > 0)
            AuditLog.Write(db, context, "activity.reordered", "section", section.Id, Name(Current(context), section.Title), changes);
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
        if (await SourceError(db, values, activity.Type, course.Id, context.RequestAborted) is { } sourceError)
            return Invalid(new() { ["src"] = sourceError });
        var before = Fields(activity, from);
        // Как в updateActivity мока: пустой или нестроковый sectionId не переносит материал.
        var sectionId = input.Value("sectionId") is { ValueKind: System.Text.Json.JsonValueKind.String } raw ? raw.GetString() : null;
        var to = string.IsNullOrEmpty(sectionId) ? from : course.Sections.Find(section => section.Id == sectionId);
        if (to is null) return Fail(400, "Такого модуля нет", new() { ["sectionId"] = "Такого модуля нет" });
        if (to != from)
        {
            // SectionId входит в owned-ключ: создаём копию вместо изменения владельца tracked-сущности.
            var moved = new Activity { Id = activity.Id, Type = activity.Type, Title = activity.Title,
                Src = activity.Src, Pages = activity.Pages, DurationMin = activity.DurationMin,
                Description = activity.Description, MaxGrade = activity.MaxGrade, MaxAttempts = activity.MaxAttempts,
                Due = activity.Due };
            from.Activities.Remove(activity);
            to.Activities.Add(moved);
            db.ChangeTracker.DetectChanges();
            Positions(db, from);
            Positions(db, to); // Перенос — в конец целевого модуля, как в моке.
            activity = moved;
        }
        values.Apply(activity);
        var changes = Compare(before, Fields(activity, to));
        if (changes.Count > 0)
            AuditLog.Write(db, context, "activity.updated", "activity", activity.Id, Name(course, activity.Title), changes);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(activity);
    }

    private static async Task<IResult> DeleteActivityAsync(string activityId, HttpContext context, LearningDbContext db)
    {
        var course = Current(context);
        var section = course.Sections.Find(section => section.Activities.Any(activity => activity.Id == activityId));
        var activity = section?.Activities.Find(activity => activity.Id == activityId);
        if (section is null || activity is null) return Fail(404, "not found");
        if (await db.Submissions.AnyAsync(item => item.CourseId == course.Id && item.ActivityId == activityId, context.RequestAborted))
            return Fail(409, "По заданию уже есть сданные работы — удалить его нельзя, чтобы не потерять оценки");
        // В корзину курса — со снимком вопросов и навыков (восстановление вернёт всё на место).
        await CourseTrash.TrashActivityAsync(db, context, course, section, activity, context.RequestAborted);
        // История попыток остаётся в снимках, текущие привязки удалённого материала очищаются.
        db.ActivitySkills.RemoveRange(await db.ActivitySkills.Where(item => item.CourseId == course.Id && item.ActivityId == activityId).ToListAsync(context.RequestAborted));
        db.QuizQuestions.RemoveRange(await db.QuizQuestions.Where(item => item.CourseId == course.Id && item.ActivityId == activityId).ToListAsync(context.RequestAborted));
        db.StudentPins.RemoveRange(await db.StudentPins.Where(item => item.CourseId == course.Id && item.ActivityId == activityId).ToListAsync(context.RequestAborted));
        section.Activities.Remove(activity);
        Positions(db, section);
        AuditLog.Write(db, context, "activity.deleted", "activity", activity.Id, Name(course, activity.Title));
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
        if (course.DeletedAt is not null || !AccessRules.CanEditCourse(actor, course)) return Fail(404, "not found");
        http.Items[typeof(Course)] = course;
        return await next(context);
    }
}
