using HeliosEdu.Api.Audit;
using System.Globalization;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Notifications;

// Объявления курсов и уведомления — те же пути и ответы, что у маршрутов Next на моках
// (src/app/api/courses/[id]/announcements, src/app/api/notifications).
public static class NotificationsEndpoints
{
    private static readonly CultureInfo Russian = CultureInfo.GetCultureInfo("ru-RU");
    private static readonly TimeSpan DeadlineWindow = TimeSpan.FromDays(3);

    private static Account Actor(HttpContext context) => (Account)context.Items[typeof(Account)]!;

    public static void MapNotificationsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api").RequireAuthorization().AddEndpointFilter<ManagementWriteFilter>();
        group.MapGet("/courses/{id}/announcements", ListAnnouncementsAsync).Produces<AnnouncementInfo[]>();
        group.MapPost("/courses/{id}/announcements", CreateAnnouncementAsync).Produces<AnnouncementInfo>(201);
        group.MapDelete("/courses/{id}/announcements/{announcementId}", DeleteAnnouncementAsync)
            .RequireAuthorization(AccessRules.EditCourse);
        group.MapGet("/notifications", ListNotificationsAsync).Produces<NotificationInfo[]>();
        group.MapPost("/notifications/{id}/read", MarkReadAsync);
        group.MapPost("/notifications/read", MarkManyReadAsync);
    }

    private static bool CanDelete(Account actor, Announcement a) =>
        actor.Role is "admin" or "organizer" || actor.Role == "tutor" && a.AuthorId == actor.Id;

    private static AnnouncementInfo Info(Announcement a, Account actor) =>
        new(a.Id, a.CourseId, a.Title, a.Body, a.AuthorName, a.CreatedAt, CanDelete(actor, a));

    private static async Task<IResult> ListAnnouncementsAsync(string id, HttpContext context, LearningDbContext db)
    {
        if (!await AccessRules.VisibleCourses(db, context.User).AnyAsync(course => course.Id == id, context.RequestAborted))
            return Fail(404, "not found");
        var items = await db.Announcements.AsNoTracking().Where(a => a.CourseId == id)
            .OrderByDescending(a => a.CreatedAt).ToListAsync(context.RequestAborted);
        return Results.Ok(items.Select(a => Info(a, Actor(context))));
    }

    // Объявление пишет тот, кто правит курс: преподаватель своего курса, организатор, администратор.
    private static async Task<IResult> CreateAnnouncementAsync(string id, HttpContext context, LearningDbContext db,
        IConfiguration configuration)
    {
        var actor = Actor(context);
        // выключатель — в настройках системы (администратор)
        if (!(await AuditEndpoints.SettingsAsync(db, actor.TenantId, configuration, context.RequestAborted)).AnnouncementsEnabled)
            return Fail(403, "Объявления отключены администратором");
        var course = await AccessRules.VisibleCourses(db, context.User)
            .SingleOrDefaultAsync(course => course.Id == id, context.RequestAborted);
        if (course is null) return Fail(404, "not found");
        if (!AccessRules.CanEditCourse(actor, course))
            return Fail(403, "Менять содержимое курса может его преподаватель или организатор");
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var fields = new Dictionary<string, string>();
        var title = input.Text("title");
        var body = input.Text("body");
        if (title.Length is < 3 or > 120) fields["title"] = "Заголовок — от 3 до 120 символов";
        if (body.Length is < 1 or > 2000) fields["body"] = "Текст — от 1 до 2000 символов";
        if (fields.Count > 0) return Invalid(fields);
        var announcement = new Announcement { Id = $"an-{Guid.NewGuid().ToString("N")[..8]}", CourseId = id,
            Title = title, Body = body, AuthorId = actor.Id, AuthorName = actor.Name, CreatedAt = DateTimeOffset.UtcNow };
        db.Announcements.Add(announcement);
        AuditLog.Write(db, context, "announcement.created", "announcement", announcement.Id, $"{course.Code} · {title}");
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Json(Info(announcement, actor), statusCode: 201);
    }

    private static async Task<IResult> DeleteAnnouncementAsync(string id, string announcementId, HttpContext context, LearningDbContext db)
    {
        var course = await AccessRules.VisibleCourses(db, context.User).SingleOrDefaultAsync(c => c.Id == id, context.RequestAborted);
        if (course is null || !AccessRules.CanEditCourse(Actor(context), course)) return Fail(404, "not found");
        var item = await db.Announcements.SingleOrDefaultAsync(a => a.CourseId == id && a.Id == announcementId, context.RequestAborted);
        if (item is null) return Fail(404, "not found");
        if (!CanDelete(Actor(context), item)) return Fail(403, "Можно удалить только своё объявление");
        db.Announcements.Remove(item);
        await db.NotificationReads.Where(r => r.NotificationId == item.Id).ExecuteDeleteAsync(context.RequestAborted);
        AuditLog.Write(db, context, "announcement.deleted", "announcement", item.Id, $"{course.Code} · {item.Title}");
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }

    private static async Task<IResult> ListNotificationsAsync(HttpContext context, LearningDbContext db) =>
        Results.Ok(await Collect(context, db));

    /// <summary>Уведомления пользователя: объявления видимых курсов, личные (оценки) и близкие сроки (ученику).</summary>
    private static async Task<List<NotificationInfo>> Collect(HttpContext context, LearningDbContext db)
    {
        var actor = Actor(context);
        var token = context.RequestAborted;
        var courses = await AccessRules.VisibleCourses(db, context.User).AsNoTracking().AsSplitQuery()
            .Include(course => course.Sections).ThenInclude(section => section.Activities).ToListAsync(token);
        var codes = courses.ToDictionary(course => course.Id, course => course.Code);
        var titles = courses.ToDictionary(course => course.Id, course => course.Title);
        var courseIds = codes.Keys.ToList();
        var read = (await db.NotificationReads.AsNoTracking().Where(item => item.UserId == actor.Id)
            .Select(item => item.NotificationId).ToListAsync(token)).ToHashSet();

        var result = new List<NotificationInfo>();
        if (actor.Role == "student")
            foreach (var a in await db.Announcements.AsNoTracking().Where(a => courseIds.Contains(a.CourseId)).ToListAsync(token))
                result.Add(new NotificationInfo(a.Id, "announcement", $"{codes[a.CourseId]}: {a.Title}",
                    $"{a.Body} — {a.AuthorName}", a.CreatedAt, read.Contains(a.Id), $"/courses/{a.CourseId}", a.CourseId, titles[a.CourseId]));
        foreach (var n in await db.Notifications.AsNoTracking().Where(n => n.UserId == actor.Id).ToListAsync(token))
            result.Add(new NotificationInfo(n.Id, n.Type, n.Title, n.Body, n.CreatedAt, read.Contains(n.Id), n.Link,
                n.CourseId, n.CourseId is { } courseId ? titles.GetValueOrDefault(courseId) : null));
        if (actor.Role == "student") result.AddRange(await Deadlines(db, actor, courses, read, token));
        return result.OrderByDescending(item => item.CreatedAt).ToList();
    }

    /// <summary>
    /// «Скоро дедлайн»: задания и тесты со сроком в ближайшие 3 дня, которые ученик ещё не сдал.
    /// Id стабильный (due-курс-материал) — прочитанность сохраняется.
    /// </summary>
    private static async Task<List<NotificationInfo>> Deadlines(LearningDbContext db, Account actor, List<Course> courses,
        HashSet<string> read, CancellationToken token)
    {
        var now = DateTimeOffset.UtcNow;
        var submitted = (await db.Submissions.AsNoTracking().Where(item => item.UserId == actor.Id)
            .Select(item => item.CourseId + "/" + item.ActivityId).ToListAsync(token)).ToHashSet();
        submitted.UnionWith(await db.QuizAttempts.AsNoTracking().Where(item => item.UserId == actor.Id && item.SubmittedAt != null)
            .Select(item => item.CourseId + "/" + item.ActivityId).ToListAsync(token));
        var result = new List<NotificationInfo>();
        foreach (var course in courses.Where(course => course.Status == "published"))
            foreach (var activity in course.Sections.SelectMany(section => section.Activities))
            {
                if (activity.Type is not ("assignment" or "quiz") || submitted.Contains(course.Id + "/" + activity.Id)) continue;
                if (activity.Due is not { } due) continue;
                if (due < now || due - now > DeadlineWindow) continue;
                var id = $"due-{course.Id}-{activity.Id}";
                result.Add(new NotificationInfo(id, "deadline", "Скоро дедлайн",
                    $"{activity.Title} — до {due.ToString("d MMMM", Russian)}", due - DeadlineWindow, read.Contains(id),
                    $"/courses/{course.Id}", course.Id, course.Title));
            }
        return result;
    }

    private static async Task<IResult> MarkReadAsync(string id, HttpContext context, LearningDbContext db)
    {
        var actor = Actor(context);
        if (id.Length is 0 or > 200) return Fail(400, "Некорректный запрос");
        // отметить можно только своё уведомление (чужое и несуществующее — 404)
        if (!(await Collect(context, db)).Any(item => item.Id == id)) return Fail(404, "not found");
        // повторное нажатие (или два открытых окна) — не ошибка
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "NotificationReads" ("UserId", "NotificationId", "ReadAt")
            VALUES ({actor.Id}, {id}, {DateTimeOffset.UtcNow}) ON CONFLICT DO NOTHING
            """, context.RequestAborted);
        return Results.Ok(new { ok = true });
    }

    private static async Task<IResult> MarkManyReadAsync(HttpContext context, LearningDbContext db)
    {
        var input = await ManagementInput.ReadAsync(context.Request);
        var ids = input?.Ids("ids");
        if (ids is null || ids.Length is < 1 or > 200 || ids.Any(id => id.Length is < 1 or > 200))
            return Fail(400, "Выберите от 1 до 200 уведомлений");
        var visible = (await Collect(context, db)).Select(n => n.Id).ToHashSet();
        if (ids.Any(id => !visible.Contains(id))) return Fail(404, "not found");
        var actor = Actor(context);
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "NotificationReads" ("UserId", "NotificationId", "ReadAt")
            SELECT {actor.Id}, item.id, {DateTimeOffset.UtcNow} FROM unnest({ids}) AS item(id)
            ON CONFLICT DO NOTHING
            """, context.RequestAborted);
        return Results.Ok(new { ok = true });
    }
}
