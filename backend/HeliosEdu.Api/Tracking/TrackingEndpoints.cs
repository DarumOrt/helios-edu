using System.Text.Json;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Tracking;

// Трекинг изучения, аналитика курса и урока, лидерборд и расписание (docs/backend/p7-tracking.md).
// Те же пути и ответы, что у моков Next (src/mocks/tracking-store.ts); ученик — из сессии, материал — пара курс + id.
public static class TrackingEndpoints
{
    private static readonly string[] Tracked = ["video", "pdf", "presentation", "quiz"];
    private static readonly HashSet<string> Verbs =
        ["opened", "played", "paused", "seeked", "ratechanged", "page_viewed", "completed", "closed"];
    private const int MaxBatch = 200;

    private static Account Actor(HttpContext context) => (Account)context.Items[typeof(Account)]!;
    private static long Ms(DateTimeOffset at) => at.ToUnixTimeMilliseconds();

    public static void MapTrackingEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api").RequireAuthorization().AddEndpointFilter<ManagementWriteFilter>();
        group.MapPost("/tracking/progress", SaveProgressAsync).Produces<TrackingAccepted>();
        group.MapGet("/tracking/progress", GetProgressAsync).Produces<ProgressInfo>();
        group.MapPost("/tracking/events", SaveEventsAsync).Produces<TrackingAccepted>();
        group.MapGet("/analytics/course/{courseId}", CourseStatsAsync).Produces<CourseActivityStats>();
        group.MapGet("/analytics/lesson/{activityId}", LessonStatsAsync).Produces<LessonStats>();
        group.MapGet("/hub/leaderboard", LeaderboardAsync).Produces<Leaderboard>();
        group.MapGet("/schedule", ScheduleAsync).Produces<ScheduleInfo>();
    }

    private static async Task<Course?> VisibleCourse(LearningDbContext db, HttpContext context, string? courseId) =>
        string.IsNullOrEmpty(courseId) ? null : await AccessRules.VisibleCourses(db, context.User).AsNoTracking()
            .AsSplitQuery().Include(course => course.Sections.OrderBy(section => section.Order))
            .ThenInclude(section => section.Activities.OrderBy(activity => EF.Property<int>(activity, "Position")))
            .SingleOrDefaultAsync(course => course.Id == courseId, context.RequestAborted);

    /// <summary>Материалы курса, по которым ведётся трекинг, — в порядке курса (его задаёт загрузка VisibleCourse).</summary>
    private static List<Activity> TrackedActivities(Course course) =>
        course.Sections.SelectMany(section => section.Activities).Where(activity => Tracked.Contains(activity.Type)).ToList();

    private static int Clamp(double? value, int min, int max) => (int)Math.Clamp(Math.Round(value ?? 0), min, max);

    // ---- приём данных ----

    /// <summary>
    /// POST — снимок прогресса { courseId, activityId, activityType, sessionId, coverage, activeTimeSec, completed, … }.
    /// Слияние сессий — в базе одним запросом (без гонок): покрытие, время и страницы — максимум, «завершено» не снимается.
    /// </summary>
    private static async Task<IResult> SaveProgressAsync(HttpContext context, LearningDbContext db)
    {
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var course = await VisibleCourse(db, context, input.Text("courseId"));
        var activity = course is null ? null : TrackedActivities(course).FirstOrDefault(item => item.Id == input.Text("activityId"));
        if (course is null || activity is null) return Fail(404, "not found");
        var session = input.Text("sessionId");
        if (session.Length is 0 or > 100) return Invalid(new() { ["sessionId"] = "Нет идентификатора сессии" });

        var actor = Actor(context);
        var now = DateTimeOffset.UtcNow;
        var coverage = Clamp(input.Number("coverage"), 0, 100);
        var activeTime = Clamp(input.Number("activeTimeSec"), 0, 7 * 24 * 3600);
        var completed = input.Value("completed")?.ValueKind == JsonValueKind.True;
        var seeks = Clamp(input.Number("seeks"), 0, 100_000);
        var pauses = Clamp(input.Number("pauses"), 0, 100_000);
        var maxRate = Math.Clamp(input.Number("maxRate") ?? 1, 0.1, 16);
        int? pages = input.Number("pagesViewed") is { } viewed ? Clamp(viewed, 0, 10_000) : null;
        int? total = input.Number("totalPages") is { } all ? Clamp(all, 0, 10_000) : null;
        double? duration = input.Number("durationSec") is { } length && length >= 0 ? length : null;
        int? position = input.Number("position") is { } at ? Clamp(at, 0, 1_000_000) : null;
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "ActivityProgress" AS t ("UserId", "CourseId", "ActivityId", "ActivityType", "Coverage",
                "ActiveTimeSec", "Completed", "Seeks", "Pauses", "MaxRate", "PagesViewed", "TotalPages", "DurationSec",
                "Position", "Sessions", "LastSessionId", "FirstAt", "LastAt")
            VALUES ({actor.Id}, {course.Id}, {activity.Id}, {activity.Type}, {coverage}, {activeTime}, {completed},
                {seeks}, {pauses}, {maxRate}, {pages}, {total}, {duration}, {position}, 1, {session}, {now}, {now})
            ON CONFLICT ("UserId", "CourseId", "ActivityId") DO UPDATE SET
                "Coverage" = GREATEST(t."Coverage", EXCLUDED."Coverage"),
                "ActiveTimeSec" = GREATEST(t."ActiveTimeSec", EXCLUDED."ActiveTimeSec"),
                "Completed" = t."Completed" OR EXCLUDED."Completed",
                "Seeks" = EXCLUDED."Seeks", "Pauses" = EXCLUDED."Pauses",
                "MaxRate" = GREATEST(t."MaxRate", EXCLUDED."MaxRate"),
                "PagesViewed" = GREATEST(t."PagesViewed", EXCLUDED."PagesViewed"),
                "TotalPages" = COALESCE(EXCLUDED."TotalPages", t."TotalPages"),
                "DurationSec" = COALESCE(EXCLUDED."DurationSec", t."DurationSec"),
                "Position" = COALESCE(EXCLUDED."Position", t."Position"),
                "Sessions" = t."Sessions" + CASE WHEN t."LastSessionId" <> EXCLUDED."LastSessionId" THEN 1 ELSE 0 END,
                "LastSessionId" = EXCLUDED."LastSessionId",
                "LastAt" = EXCLUDED."LastAt"
            """, context.RequestAborted);
        return Results.Ok(new TrackingAccepted(true, 1));
    }

    /// <summary>GET ?courseId=&amp;activityId= — свой прогресс по материалу (нет — null).</summary>
    private static async Task<IResult> GetProgressAsync(string? courseId, string? activityId, HttpContext context, LearningDbContext db)
    {
        if (await VisibleCourse(db, context, courseId) is null) return Fail(404, "not found");
        var actor = Actor(context);
        var row = await db.ActivityProgress.AsNoTracking().SingleOrDefaultAsync(item => item.UserId == actor.Id &&
            item.CourseId == courseId && item.ActivityId == activityId, context.RequestAborted);
        return Results.Json(row is null ? null : Info(row, actor.Name, actor.Group));
    }

    private static ProgressInfo Info(ActivityProgress row, string name, string? group) => new(row.LastSessionId, row.UserId,
        row.ActivityId, row.ActivityType, row.Coverage, row.ActiveTimeSec, row.Completed, row.Seeks, row.Pauses,
        row.MaxRate, row.PagesViewed, row.TotalPages, row.DurationSec, row.Position, Ms(row.LastAt), name, group,
        Ms(row.FirstAt), Ms(row.LastAt), row.Sessions);

    /// <summary>POST { courseId, events: [{ sessionId, activityId, activityType, verb, position?, payload?, ts }] } — до 200 за раз.</summary>
    private static async Task<IResult> SaveEventsAsync(HttpContext context, LearningDbContext db)
    {
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input?.Value("events") is not { ValueKind: JsonValueKind.Array } events) return Fail(400, "Некорректный запрос");
        if (events.GetArrayLength() > MaxBatch) return Fail(400, $"Не больше {MaxBatch} событий за раз");
        var course = await VisibleCourse(db, context, input.Text("courseId"));
        if (course is null) return Fail(404, "not found");
        var materials = TrackedActivities(course).ToDictionary(activity => activity.Id, activity => activity.Type);
        var actor = Actor(context);
        var now = DateTimeOffset.UtcNow;
        var accepted = 0;
        foreach (var item in events.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object) continue;
            string Text(string name) => item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString()! : "";
            var verb = Text("verb");
            var activityId = Text("activityId");
            // «пульс» не храним; чужие материалы и неизвестные глаголы пропускаем
            if (!Verbs.Contains(verb) || !materials.TryGetValue(activityId, out var type)) continue;
            // время с клиента — если правдоподобно (сутки назад … минута вперёд), иначе время сервера
            var at = item.TryGetProperty("ts", out var ts) && ts.TryGetInt64(out var ms) &&
                     DateTimeOffset.FromUnixTimeMilliseconds(Math.Clamp(ms, 0, 253402300799999)) is var clientAt &&
                     clientAt > now.AddDays(-1) && clientAt < now.AddMinutes(1) ? clientAt : now;
            db.TrackingEvents.Add(new TrackingEvent
            {
                At = at, UserId = actor.Id, CourseId = course.Id, ActivityId = activityId, ActivityType = type,
                SessionId = Text("sessionId") is { Length: > 0 and <= 100 } session ? session : "—", Verb = verb,
                Position = item.TryGetProperty("position", out var position) && position.TryGetDouble(out var value) ? value : null,
                Payload = item.TryGetProperty("payload", out var payload) && payload.ValueKind == JsonValueKind.Object &&
                          payload.GetRawText().Length <= 2000 ? payload.Clone() : null,
            });
            accepted++;
        }
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(new TrackingAccepted(true, accepted));
    }

    // ---- аналитика (преподаватель своего курса, организатор, администратор) ----

    private static async Task<(Course? Course, IResult? Error)> StaffCourse(LearningDbContext db, HttpContext context, string? courseId)
    {
        if (Actor(context).Role == "student") return (null, Fail(403, "Недостаточно прав"));
        var course = await VisibleCourse(db, context, courseId);
        return course is null ? (null, Fail(404, "not found")) : (course, null);
    }

    private static async Task<List<Account>> Roster(LearningDbContext db, string courseId, CancellationToken token) =>
        await AccessRules.CourseStudents(db, courseId).AsNoTracking().OrderBy(account => account.Name).ToListAsync(token);

    private static async Task<IResult> CourseStatsAsync(string courseId, HttpContext context, LearningDbContext db)
    {
        var (course, error) = await StaffCourse(db, context, courseId);
        if (error is not null) return error;
        var roster = await Roster(db, courseId, context.RequestAborted);
        var ids = roster.Select(account => account.Id).ToList();
        var rows = await db.ActivityProgress.AsNoTracking().Where(item => item.CourseId == courseId && ids.Contains(item.UserId))
            .ToListAsync(context.RequestAborted);
        return Results.Ok(new CourseActivityStats(TrackedActivities(course!).Select(activity =>
        {
            var present = rows.Where(row => row.ActivityId == activity.Id).ToList();
            return new CourseActivityStat(activity.Id, activity.Title, activity.Type, present.Count,
                present.Count(row => row.Completed), roster.Count,
                present.Count == 0 ? 0 : (int)Math.Round(present.Average(row => row.Coverage)),
                present.Count == 0 ? 0 : (int)Math.Round(present.Average(row => row.ActiveTimeSec)));
        }).ToList()));
    }

    /// <summary>GET ?courseId=&amp;userId= — строки по ученикам курса; с userId — его строка и лента событий.</summary>
    private static async Task<IResult> LessonStatsAsync(string activityId, string? courseId, string? userId,
        HttpContext context, LearningDbContext db)
    {
        var (course, error) = await StaffCourse(db, context, courseId);
        if (error is not null) return error;
        if (TrackedActivities(course!).All(activity => activity.Id != activityId)) return Fail(404, "not found");
        var roster = await Roster(db, course!.Id, context.RequestAborted);
        if (!string.IsNullOrEmpty(userId)) roster = roster.Where(account => account.Id == userId).ToList();
        var ids = roster.Select(account => account.Id).ToList();
        var rows = await db.ActivityProgress.AsNoTracking().Where(item => item.CourseId == course.Id &&
            item.ActivityId == activityId && ids.Contains(item.UserId)).ToDictionaryAsync(item => item.UserId, context.RequestAborted);
        var result = roster.Select(account =>
        {
            var row = rows.GetValueOrDefault(account.Id);
            return new LessonStatRow(account.Id, account.Name, account.Group, row?.Coverage ?? 0, row?.ActiveTimeSec ?? 0,
                row?.Completed ?? false, row?.Seeks, row?.PagesViewed, row?.TotalPages, row is null ? null : Ms(row.LastAt),
                row is null ? "not_started" : row.Completed ? "completed" : "in_progress");
        }).ToList();
        List<TrackingEventInfo>? events = null;
        if (!string.IsNullOrEmpty(userId))
            events = (await db.TrackingEvents.AsNoTracking().Where(item => item.CourseId == course.Id &&
                    item.ActivityId == activityId && item.UserId == userId).OrderBy(item => item.At).ThenBy(item => item.Id)
                    .Take(2000).ToListAsync(context.RequestAborted))
                .Select(item => new TrackingEventInfo(item.Id.ToString(), item.SessionId, item.UserId, item.ActivityId,
                    item.ActivityType, item.Verb, item.Position, item.Payload, Ms(item.At))).ToList();
        return Results.Ok(new LessonStats(result, events));
    }

    // ---- лидерборд группы по курсу ----

    /// <summary>
    /// Балл: 50% — среднее покрытие видео и документов, 30% — средний лучший результат тестов (попытки P5 и трекинг),
    /// 20% — доля пройденных материалов (как «пройдено» в прогрессе курса). Серия — дни подряд с занятиями.
    /// </summary>
    private static async Task<IResult> LeaderboardAsync(string? courseId, HttpContext context, LearningDbContext db)
    {
        var course = await VisibleCourse(db, context, courseId);
        if (course is null) return Fail(404, "not found");
        var token = context.RequestAborted;
        var roster = await Roster(db, course.Id, token);
        var ids = roster.Select(account => account.Id).ToList();
        var tracked = TrackedActivities(course);
        var content = tracked.Where(activity => activity.Type != "quiz").Select(activity => activity.Id).ToList();
        var quizzes = tracked.Where(activity => activity.Type == "quiz").Select(activity => activity.Id).ToList();
        // по тесту в прогрессе — лучший процент (тест отправляет результат каждой попытки, сохраняется максимум)
        var coverage = await db.ActivityProgress.AsNoTracking().Where(item => item.CourseId == course.Id && ids.Contains(item.UserId))
            .Select(item => new { item.UserId, item.ActivityId, item.Coverage }).ToListAsync(token);
        var attempts = await db.QuizAttempts.AsNoTracking().Where(item => item.CourseId == course.Id && ids.Contains(item.UserId) &&
            item.SubmittedAt != null && item.Max > 0).Select(item => new { item.UserId, item.ActivityId, item.Score, item.Max })
            .ToListAsync(token);
        var progress = await CourseProgress.ForUsers(db, course, ids, token);
        var materialsTotal = course.Sections.Sum(section => section.Activities.Count);
        var streaks = await Streaks(db, course.Id, ids, token);
        var me = Actor(context).Id;

        var entries = roster.Select(account =>
        {
            var covered = content.Select(id => coverage.FirstOrDefault(row => row.UserId == account.Id && row.ActivityId == id)?.Coverage ?? 0).ToList();
            var avgCoverage = covered.Count == 0 ? 0 : (int)Math.Round(covered.Average());
            var best = quizzes.Select(id => attempts.Where(row => row.UserId == account.Id && row.ActivityId == id)
                    .Select(row => 100d * (row.Score ?? 0) / row.Max)
                    .Concat(coverage.Where(row => row.UserId == account.Id && row.ActivityId == id).Select(row => (double)row.Coverage))
                    .DefaultIfEmpty(-1).Max())
                .Where(percent => percent >= 0).ToList();
            int? quizAvg = best.Count == 0 ? null : (int)Math.Round(best.Average());
            var done = progress[account.Id].Done.Count;
            var completion = materialsTotal == 0 ? 0 : 100d * done / materialsTotal;
            var score = (int)Math.Round(avgCoverage * 0.5 + (quizAvg ?? 0) * 0.3 + completion * 0.2);
            return new LeaderboardEntry(0, account.Id, account.Name, account.Group ?? "—", score, done, materialsTotal,
                avgCoverage, quizAvg, streaks.GetValueOrDefault(account.Id), account.Id == me ? true : null);
        }).OrderByDescending(entry => entry.Score).ThenByDescending(entry => entry.AvgCoverage).ThenBy(entry => entry.UserName)
            .Select((entry, index) => entry with { Rank = index + 1 }).ToList();
        return Results.Ok(new Leaderboard(course.Id, entries));
    }

    /// <summary>Сколько дней подряд (до сегодня или вчера) ученик занимался курсом: просмотры, события P5, тесты.</summary>
    private static async Task<Dictionary<string, int>> Streaks(LearningDbContext db, string courseId, List<string> ids,
        CancellationToken token)
    {
        var since = DateTimeOffset.UtcNow.AddDays(-60);
        var days = (await db.TrackingEvents.AsNoTracking().Where(item => item.CourseId == courseId && ids.Contains(item.UserId) && item.At >= since)
                .Select(item => new { item.UserId, item.At }).ToListAsync(token))
            .Concat(await db.ActivityProgress.AsNoTracking().Where(item => item.CourseId == courseId && ids.Contains(item.UserId) && item.LastAt >= since)
                .Select(item => new { item.UserId, At = item.LastAt }).ToListAsync(token))
            .Concat(await db.LearningEvents.AsNoTracking().Where(item => item.CourseId == courseId && ids.Contains(item.UserId) && item.At >= since)
                .Select(item => new { item.UserId, item.At }).ToListAsync(token))
            .GroupBy(item => item.UserId)
            .ToDictionary(group => group.Key, group => group.Select(item => DateOnly.FromDateTime(item.At.UtcDateTime)).ToHashSet());
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return days.ToDictionary(pair => pair.Key, pair =>
        {
            var day = pair.Value.Contains(today) ? today : today.AddDays(-1);
            var streak = 0;
            while (pair.Value.Contains(day)) { streak++; day = day.AddDays(-1); }
            return streak;
        });
    }

    // ---- расписание ----

    private static readonly PairTimeInfo[] Pairs =
    [
        new(1, "08:00", "09:35"), new(2, "09:45", "11:20"), new(3, "11:30", "13:05"), new(4, "13:30", "15:05"),
        new(5, "15:15", "16:50"), new(6, "17:00", "18:35"), new(7, "18:45", "20:20"), new(8, "20:30", "22:05"),
    ];

    /// <summary>GET ?group= — пары группы на неделю. Студент — только своя группа; без группы — 400.</summary>
    private static async Task<IResult> ScheduleAsync(string? group, HttpContext context, LearningDbContext db)
    {
        if (string.IsNullOrWhiteSpace(group)) return Fail(400, "Укажите группу");
        var actor = Actor(context);
        if (!AccessRules.CanViewGroup(actor, group)) return Fail(403, "Недостаточно прав");
        var slots = await db.ScheduleSlots.AsNoTracking().Where(slot => slot.TenantId == actor.TenantId && slot.Group == group)
            .OrderBy(slot => slot.Weekday).ThenBy(slot => slot.Pair).ToListAsync(context.RequestAborted);
        var courseIds = slots.Select(slot => slot.CourseId).Distinct().ToList();
        var courses = await db.Courses.AsNoTracking().Where(course => courseIds.Contains(course.Id))
            .ToDictionaryAsync(course => course.Id, context.RequestAborted);
        return Results.Ok(new ScheduleInfo(group, Pairs, slots.Select(slot => new ScheduleSlotInfo(slot.Id, slot.CourseId,
            slot.Weekday, slot.Pair, slot.Kind, slot.Room,
            courses.TryGetValue(slot.CourseId, out var course)
                ? new ScheduleCourse(course.Id, course.Code, course.Title, course.CoverColor) : null)).ToList()));
    }
}
