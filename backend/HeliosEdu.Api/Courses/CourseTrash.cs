using System.Text.Json;
using HeliosEdu.Api.Adaptive;
using HeliosEdu.Api.Audit;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Courses;

/// <summary>
/// Удалённый модуль или материал курса: снимок для восстановления (как «Корзина» Moodle). Сам материал из курса
/// удаляется сразу — так его не видят ни ученики, ни расчёты; через <see cref="CourseTrash.Lifetime"/> снимок
/// стирается окончательно вместе с прогрессом по материалу.
/// </summary>
public sealed class TrashItem
{
    public string Id { get; set; } = "";
    public string CourseId { get; set; } = "";
    /// <summary>section или activity</summary>
    public string Kind { get; set; } = "";
    public string ItemId { get; set; } = "";
    public string Title { get; set; } = "";
    public JsonElement Snapshot { get; set; }
    public DateTimeOffset DeletedAt { get; set; }
    public string DeletedByName { get; set; } = "";
}

/// <summary>Снимок материала: сам материал, где он был, вопросы теста и привязки навыков.</summary>
public sealed record ActivitySnapshot(Activity Activity, string SectionId, string SectionTitle, int Position,
    List<QuizQuestion> Questions, List<string> SkillIds);

public sealed record SectionSnapshot(string Title, int Order);

/// <summary>Удалённое в корзине курса: GET /api/courses/{id}/trash.</summary>
public sealed record TrashItemInfo(string Id, string Kind, string Title, string? Type, string? SectionTitle,
    DateTimeOffset DeletedAt, string DeletedByName, DateTimeOffset PurgeAt);

/// <summary>Что потеряется с курсом — для подтверждения удаления: GET /api/courses/{id}/impact.</summary>
public sealed record CourseImpact(int Students, int Submissions, int Grades, int Attempts);

/// <summary>Курс в корзине курсов: GET /api/courses/trash.</summary>
public sealed record DeletedCourseInfo(string Id, string Code, string Title, string TutorId, DateTimeOffset DeletedAt,
    string DeletedByName, DateTimeOffset PurgeAt, CourseImpact Impact);

/// <summary>Итог очистки корзин (FileJanitor): окончательно удалено курсов и элементов курсов.</summary>
public sealed record TrashPurgeResult(int Courses, int Items);

public static class CourseTrash
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static Account Actor(HttpContext context) => (Account)context.Items[typeof(Account)]!;

    public static void MapCourseTrashEndpoints(this WebApplication app)
    {
        // удаляет и восстанавливает курс тот, кто его правит: преподаватель — свой, организатор и администратор — любой
        var courses = app.MapGroup("/api/courses").RequireAuthorization(AccessRules.EditCourse)
            .AddEndpointFilter<ManagementWriteFilter>();
        courses.MapGet("/trash", ListDeletedCoursesAsync).Produces<DeletedCourseInfo[]>();
        courses.MapGet("/{id}/impact", ImpactAsync).Produces<CourseImpact>();
        courses.MapDelete("/{id}", DeleteCourseAsync);
        courses.MapPost("/{id}/restore", RestoreCourseAsync).Produces<CourseSummary>();
    }

    // ---- курс целиком ----

    /// <summary>Курс, который актор правит, — в том числе уже в корзине (для восстановления).</summary>
    private static async Task<Course?> EditableCourse(LearningDbContext db, HttpContext context, string id, bool deleted)
    {
        var course = await db.Courses.SingleOrDefaultAsync(item => item.Id == id && (item.DeletedAt != null) == deleted,
            context.RequestAborted);
        return course is not null && AccessRules.CanEditCourse(Actor(context), course) ? course : null;
    }

    public static async Task<CourseImpact> Impact(LearningDbContext db, string courseId, CancellationToken token) => new(
        await AccessRules.CourseStudents(db, courseId).CountAsync(token),
        await db.Submissions.CountAsync(item => item.CourseId == courseId, token),
        await db.Grades.CountAsync(item => item.CourseId == courseId, token),
        await db.QuizAttempts.CountAsync(item => item.CourseId == courseId && item.SubmittedAt != null, token));

    private static async Task<IResult> ImpactAsync(string id, HttpContext context, LearningDbContext db) =>
        await EditableCourse(db, context, id, false) is { } course
            ? Results.Ok(await Impact(db, course.Id, context.RequestAborted))
            : Fail(404, "not found");

    /// <summary>
    /// DELETE — курс в корзину на 7 дней: из списков и для учеников он пропадает, но оценки по нему остаются
    /// в «Моих оценках» (рейтинг сохраняется). Через 7 дней курс удаляется со всеми результатами.
    /// </summary>
    private static async Task<IResult> DeleteCourseAsync(string id, HttpContext context, LearningDbContext db)
    {
        var course = await EditableCourse(db, context, id, false);
        if (course is null) return Fail(404, "not found");
        var impact = await Impact(db, course.Id, context.RequestAborted);
        course.DeletedAt = DateTimeOffset.UtcNow;
        course.DeletedByName = Actor(context).Name;
        AuditLog.Write(db, context, "course.deleted", "course", course.Id, $"{course.Code} · {course.Title}",
            AuditLog.Diff(("Работ", null, impact.Submissions.ToString()), ("Оценок", null, impact.Grades.ToString()),
                ("Попыток тестов", null, impact.Attempts.ToString())));
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }

    private static async Task<IResult> RestoreCourseAsync(string id, HttpContext context, LearningDbContext db)
    {
        var course = await EditableCourse(db, context, id, true);
        if (course is null) return Fail(404, "not found");
        course.DeletedAt = null;
        course.DeletedByName = null;
        AuditLog.Write(db, context, "course.restored", "course", course.Id, $"{course.Code} · {course.Title}");
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(CourseSummary.From(course, (await CourseProgress.ForViewer(db, Actor(context), [course.Id],
            context.RequestAborted))[course.Id]));
    }

    private static async Task<IResult> ListDeletedCoursesAsync(HttpContext context, LearningDbContext db)
    {
        var actor = Actor(context);
        var deleted = await db.Courses.AsNoTracking().Where(course => course.DeletedAt != null &&
                (actor.Role != "tutor" || course.TutorId == actor.Id))
            .OrderByDescending(course => course.DeletedAt).ToListAsync(context.RequestAborted);
        var result = new List<DeletedCourseInfo>();
        foreach (var course in deleted)
            result.Add(new DeletedCourseInfo(course.Id, course.Code, course.Title, course.TutorId, course.DeletedAt!.Value,
                course.DeletedByName ?? "—", course.DeletedAt.Value + Lifetime, await Impact(db, course.Id, context.RequestAborted)));
        return Results.Ok(result);
    }

    // ---- модули и материалы ----

    /// <summary>Снимок материала в корзину курса (вызывается из конструктора перед удалением).</summary>
    public static async Task TrashActivityAsync(LearningDbContext db, HttpContext context, Course course, Section section,
        Activity activity, CancellationToken token)
    {
        var questions = await db.QuizQuestions.AsNoTracking()
            .Where(item => item.CourseId == course.Id && item.ActivityId == activity.Id).ToListAsync(token);
        var skills = await db.ActivitySkills.AsNoTracking()
            .Where(item => item.CourseId == course.Id && item.ActivityId == activity.Id).Select(item => item.SkillId).ToListAsync(token);
        var snapshot = new ActivitySnapshot(activity, section.Id, section.Title, section.Activities.IndexOf(activity),
            questions, skills);
        Add(db, context, course, "activity", activity.Id, activity.Title, JsonSerializer.SerializeToElement(snapshot, Json));
    }

    public static void TrashSection(LearningDbContext db, HttpContext context, Course course, Section section) =>
        Add(db, context, course, "section", section.Id, section.Title,
            JsonSerializer.SerializeToElement(new SectionSnapshot(section.Title, section.Order), Json));

    private static void Add(LearningDbContext db, HttpContext context, Course course, string kind, string itemId,
        string title, JsonElement snapshot) =>
        db.TrashItems.Add(new TrashItem
        {
            Id = $"tr-{Guid.NewGuid().ToString("N")[..10]}", CourseId = course.Id, Kind = kind, ItemId = itemId,
            Title = title, Snapshot = snapshot, DeletedAt = DateTimeOffset.UtcNow, DeletedByName = Actor(context).Name,
        });

    public static async Task<IResult> ListItemsAsync(HttpContext context, LearningDbContext db, Course course)
    {
        var items = await db.TrashItems.AsNoTracking().Where(item => item.CourseId == course.Id)
            .OrderByDescending(item => item.DeletedAt).ToListAsync(context.RequestAborted);
        return Results.Ok(items.Select(item =>
        {
            var activity = item.Kind == "activity" ? item.Snapshot.Deserialize<ActivitySnapshot>(Json) : null;
            return new TrashItemInfo(item.Id, item.Kind, item.Title, activity?.Activity.Type, activity?.SectionTitle,
                item.DeletedAt, item.DeletedByName, item.DeletedAt + Lifetime);
        }));
    }

    /// <summary>
    /// Восстановить модуль (в конец курса) или материал — на прежнее место в своём модуле; если модуля уже нет,
    /// он создаётся заново с прежним названием. Возвращаются и вопросы теста, и привязки к ещё существующим навыкам.
    /// </summary>
    public static async Task<IResult> RestoreItemAsync(string itemId, HttpContext context, LearningDbContext db, Course course,
        Action<Section> positions)
    {
        var token = context.RequestAborted;
        var item = await db.TrashItems.SingleOrDefaultAsync(row => row.Id == itemId && row.CourseId == course.Id, token);
        if (item is null) return Fail(404, "not found");
        if (item.Kind == "section")
        {
            var snapshot = item.Snapshot.Deserialize<SectionSnapshot>(Json)!;
            var section = course.Sections.Find(row => row.Id == item.ItemId) ?? NewSection(course, item.ItemId, snapshot.Title);
            db.TrashItems.Remove(item);
            AuditLog.Write(db, context, "section.restored", "section", section.Id, $"{course.Code} · {section.Title}");
            await db.SaveChangesAsync(token);
            return Results.Ok(section);
        }

        var saved = item.Snapshot.Deserialize<ActivitySnapshot>(Json)!;
        if (course.Sections.SelectMany(row => row.Activities).Any(row => row.Id == saved.Activity.Id))
            return Fail(409, "Материал уже есть в курсе");
        var target = course.Sections.Find(row => row.Id == saved.SectionId) ?? NewSection(course, saved.SectionId, saved.SectionTitle);
        target.Activities.Insert(Math.Clamp(saved.Position, 0, target.Activities.Count), saved.Activity);
        db.ChangeTracker.DetectChanges();
        positions(target);
        db.QuizQuestions.AddRange(saved.Questions);
        var skills = await db.Skills.Where(skill => skill.CourseId == course.Id && saved.SkillIds.Contains(skill.Id))
            .Select(skill => skill.Id).ToListAsync(token);
        db.ActivitySkills.AddRange(skills.Select(id => new ActivitySkill { CourseId = course.Id, ActivityId = saved.Activity.Id, SkillId = id }));
        db.TrashItems.Remove(item);
        AuditLog.Write(db, context, "activity.restored", "activity", saved.Activity.Id, $"{course.Code} · {saved.Activity.Title}");
        await db.SaveChangesAsync(token);
        return Results.Ok(saved.Activity);
    }

    private static Section NewSection(Course course, string id, string title)
    {
        var section = new Section { Id = id, Title = title, Order = course.Sections.Count + 1 };
        course.Sections.Add(section);
        return section;
    }

    // ---- окончательное удаление ----

    /// <summary>
    /// Стирает то, что пролежало в корзине дольше 7 дней: элементы курсов (с прогрессом по ним) и курсы целиком —
    /// со всеми работами, оценками и попытками; после этого рейтинг и статистика учеников считаются без курса.
    /// Файлы удалённого остаются без ссылок — их уберёт очистка хранилища.
    /// </summary>
    public static async Task<TrashPurgeResult> PurgeAsync(LearningDbContext db, DateTimeOffset now, CancellationToken token)
    {
        var edge = now - Lifetime;
        var items = await db.TrashItems.Where(item => item.DeletedAt < edge).ToListAsync(token);
        foreach (var item in items.Where(item => item.Kind == "activity"))
        {
            await db.ActivityProgress.Where(row => row.CourseId == item.CourseId && row.ActivityId == item.ItemId).ExecuteDeleteAsync(token);
            await db.TrackingEvents.Where(row => row.CourseId == item.CourseId && row.ActivityId == item.ItemId).ExecuteDeleteAsync(token);
        }
        db.TrashItems.RemoveRange(items);
        await db.SaveChangesAsync(token);

        var courses = await db.Courses.Where(course => course.DeletedAt != null && course.DeletedAt < edge)
            .Select(course => course.Id).ToListAsync(token);
        foreach (var id in courses)
        {
            // своя транзакция — если её не открыл вызывающий (POST /api/files/cleanup идёт в транзакции запроса)
            await using var transaction = db.Database.CurrentTransaction is null
                ? await db.Database.BeginTransactionAsync(token) : null;
            // связи без каскада (адаптивное обучение, группы) — сначала; остальное база удалит вместе с курсом
            var attempts = db.QuizAttempts.Where(row => row.CourseId == id).Select(row => row.Id);
            await db.AttemptAnswers.Where(row => attempts.Contains(row.AttemptId)).ExecuteDeleteAsync(token);
            await db.QuizAttempts.Where(row => row.CourseId == id).ExecuteDeleteAsync(token);
            await db.Recommendations.Where(row => row.CourseId == id).ExecuteDeleteAsync(token);
            await db.StudentPins.Where(row => row.CourseId == id).ExecuteDeleteAsync(token);
            await db.QuizQuestions.Where(row => row.CourseId == id).ExecuteDeleteAsync(token);
            var skills = db.Skills.Where(row => row.CourseId == id).Select(row => row.Id);
            await db.SkillMastery.Where(row => skills.Contains(row.SkillId)).ExecuteDeleteAsync(token);
            await db.Skills.Where(row => row.CourseId == id).ExecuteDeleteAsync(token);
            await db.CohortCourses.Where(row => row.CourseId == id).ExecuteDeleteAsync(token);
            // работы ссылаются на файлы курса без каскада — удаляем их до файлов
            await db.Submissions.Where(row => row.CourseId == id).ExecuteDeleteAsync(token);
            await db.TrashItems.Where(row => row.CourseId == id).ExecuteDeleteAsync(token);
            // модули и материалы (отдельные таблицы курса), оценки, объявления, файлы, прогресс — каскадом в базе
            await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM \"Courses\" WHERE \"Id\" = {id}", token);
            if (transaction is not null) await transaction.CommitAsync(token);
        }
        return new TrashPurgeResult(courses.Count, items.Count);
    }
}
