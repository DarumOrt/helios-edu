using HeliosEdu.Api.Auth;
using System.Text.Json;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Adaptive;

public static partial class AdaptiveEndpoints
{
    private static async Task<bool> StudentExists(string userId, HttpContext http, LearningDbContext db) =>
        await AccessRules.CourseStudents(db, Current(http).Id).AnyAsync(account => account.Id == userId, http.RequestAborted);

    private static Dictionary<string, string> ReasonErrors(ManagementInput input) => input.Text("reason").Length is < 3 or > 500
        ? new() { ["reason"] = "Укажите причину — от 3 до 500 символов" } : new();

    private static async Task<IResult> Dashboard(HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var course = Current(http); var token = http.RequestAborted;
        var skills = await engine.EnsureSkills(course, token);
        var accounts = await AccessRules.CourseStudents(db, course.Id)
            .OrderBy(account => account.Name).ThenBy(account => account.Id).ToListAsync(token);
        var students = new List<object>();
        foreach (var account in accounts)
        {
            var rows = await engine.Masteries(account.Id, skills, token);
            var progress = AdaptiveJson.Pack(await engine.Progress(course, account.Id, token)).GetProperty("progress").GetInt32();
            var pin = await db.StudentPins.SingleOrDefaultAsync(item => item.UserId == account.Id && item.CourseId == course.Id, token);
            students.Add(new { id = account.Id, name = account.Name, progress,
                skills = rows.ToDictionary(pair => pair.Key, pair => new { pKnown = pair.Value.PKnown, status = pair.Value.Status, unlockedByTeacher = pair.Value.UnlockedByTeacher }), pin });
        }
        return Results.Ok(new { enabled = course.AdaptiveEnabled, skills = await engine.SkillInfos(course, token), students });
    }

    private static async Task<IResult> ToggleAdaptive(HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input?.Value("enabled") is not { ValueKind: JsonValueKind.True or JsonValueKind.False } enabled)
            return Invalid(new() { ["enabled"] = "Укажите, включена ли адаптация" });
        Current(http).AdaptiveEnabled = enabled.GetBoolean();
        await TeacherCourseChange(http, db, engine, "adaptive.enabled", http.RequestAborted);
        return Results.Ok(new { enabled = enabled.GetBoolean() });
    }

    private static async Task<IResult> OverrideSkill(string userId, string skillId, HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var course = Current(http); var token = http.RequestAborted;
        if (!await StudentExists(userId, http, db)) return Fail(404, "Ученик не найден");
        var skill = await db.Skills.SingleOrDefaultAsync(item => item.Id == skillId && item.CourseId == course.Id, token);
        if (skill is null) return Fail(404, "Навык не найден");
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input is null) return BadBody();
        var errors = ReasonErrors(input);
        var action = input.Text("action");
        if (action is not ("master" or "reset" or "unlock")) errors["action"] = "Неизвестное действие";
        if (errors.Count > 0) return Invalid(errors);
        var skills = await db.Skills.Where(item => item.CourseId == course.Id).ToListAsync(token);
        var row = (await engine.Masteries(userId, skills, token))[skillId];
        var wasMastered = row.Status == "mastered";
        if (db.Entry(row).State == EntityState.Detached) db.SkillMastery.Add(row);
        switch (action)
        {
            case "master": row.PKnown = 1; row.Status = "mastered"; row.MasteredAt ??= DateTimeOffset.UtcNow; break;
            case "reset": row.PKnown = skill.PInit; row.Attempts = 0; row.Correct = 0; row.Status = "learning"; row.UnlockedByTeacher = false; row.MasteredAt = null; break;
            case "unlock": row.UnlockedByTeacher = true; if (row.Status != "mastered") row.Status = "learning"; break;
        }
        row.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(token);
        // Пересчитываются и зависимые статусы, освоенные навыки не понижаются.
        await engine.Masteries(userId, skills, token);
        if (action == "master" && !wasMastered)
            engine.Event(userId, Actor(http).Id, course.Id, "skill.mastered", new { pKnown = row.PKnown }, skillId: skillId);
        await engine.Override(userId, Actor(http).Id, course.Id, action, input.Text("reason"), token, skillId: skillId);
        return Results.Ok(row);
    }

    private static async Task<IResult> Pin(string userId, HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var course = Current(http); var token = http.RequestAborted;
        if (!await StudentExists(userId, http, db)) return Fail(404, "Ученик не найден");
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input is null || !input.Has("activityId") || !StringOrNull(input, "activityId")) return BadBody();
        var errors = ReasonErrors(input);
        var activityId = input.OptionalText("activityId");
        if (activityId is not null && !AdaptiveEngine.Materials(course).Any(item => item.Activity.Id == activityId))
            errors["activityId"] = "Материал должен быть из этого курса";
        if (errors.Count > 0) return Invalid(errors);
        var pin = await db.StudentPins.SingleOrDefaultAsync(item => item.UserId == userId && item.CourseId == course.Id, token);
        if (activityId is null)
        {
            if (pin is not null) db.StudentPins.Remove(pin);
        }
        else
        {
            if (pin is null) { pin = new StudentPin { UserId = userId, CourseId = course.Id }; db.StudentPins.Add(pin); }
            pin.ActivityId = activityId; pin.Reason = input.Text("reason"); pin.CreatedBy = Actor(http).Id; pin.CreatedAt = DateTimeOffset.UtcNow;
        }
        await engine.Override(userId, Actor(http).Id, course.Id, activityId is null ? "unpin" : "pin", input.Text("reason"), token, activityId: activityId);
        return activityId is null ? Results.NoContent() : Results.Ok(pin);
    }

    private static async Task<IResult> Events(HttpContext http, LearningDbContext db)
    {
        var actor = Actor(http); var course = Current(http);
        var userId = http.Request.Query["userId"].ToString();
        if (actor.Role == "student")
        {
            if (userId.Length > 0 && userId != actor.Id) return Fail(403, "Недостаточно прав");
            userId = actor.Id;
        }
        else if (userId.Length > 0 && !await StudentExists(userId, http, db)) return Fail(404, "Ученик не найден");
        var limit = 100;
        if (http.Request.Query.ContainsKey("limit") && (!int.TryParse(http.Request.Query["limit"], out limit) || limit < 1))
            return Invalid(new() { ["limit"] = "Лимит должен быть положительным числом" });
        limit = Math.Min(limit, 500);
        var type = http.Request.Query["type"].ToString();
        var query = db.LearningEvents.AsNoTracking().Where(item => item.CourseId == course.Id);
        if (userId.Length > 0) query = query.Where(item => item.UserId == userId);
        if (type.Length > 0) query = query.Where(item => item.Type == type);
        return Results.Ok(await query.OrderByDescending(item => item.At).ThenByDescending(item => item.Id).Take(limit).ToListAsync(http.RequestAborted));
    }

    private static async Task<IResult> ReactRecommendation(string recommendationId, HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var input = await ManagementInput.ReadAsync(http.Request);
        var status = input?.Text("status");
        if (status is not ("accepted" or "skipped")) return Invalid(new() { ["status"] = "Выберите accepted или skipped" });
        var row = await db.Recommendations.SingleAsync(item => item.Id == recommendationId && item.UserId == Actor(http).Id, http.RequestAborted);
        if (row.Status == status) return Results.NoContent();
        if (row.Status != "shown") return Fail(409, "Рекомендация уже обработана");
        row.Status = status;
        engine.Event(row.UserId, row.UserId, row.CourseId, $"recommendation.{status}", new { recommendationId, reason = row.ReasonText }, row.ActivityId, row.SkillId);
        return Results.NoContent();
    }

    private static async Task<IResult> RecordEvent(HttpContext http, AdaptiveEngine engine)
    {
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input is null) return BadBody();
        var type = input.Text("type");
        if (type is not ("activity.viewed" or "activity.completed")) return Invalid(new() { ["type"] = "Этот тип события нельзя отправить с клиента" });
        var activityId = input.Text("activityId");
        if (!AdaptiveEngine.Materials(Current(http)).Any(item => item.Activity.Id == activityId)) return Fail(404, "Материал не найден");
        double? coverage = null;
        if (input.Has("coverage"))
        {
            // В существующем плеере coverage — проценты (VideoPlayer.coverage).
            if (input.Value("coverage") is not { ValueKind: JsonValueKind.Number } value || !value.TryGetDouble(out var number) || !double.IsFinite(number) || number < 0 || number > 100)
                return Invalid(new() { ["coverage"] = "Покрытие материала — от 0 до 100 процентов" });
            coverage = number;
        }
        engine.Event(Actor(http).Id, Actor(http).Id, Current(http).Id, type, new { coverage }, activityId);
        return Results.NoContent();
    }
}
