using HeliosEdu.Api.Audit;
using System.Text.RegularExpressions;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Adaptive;

public static partial class AdaptiveEndpoints
{
    private static Course Current(HttpContext http) => (Course)http.Items[typeof(Course)]!;
    private static Account Actor(HttpContext http) => (Account)http.Items[typeof(Account)]!;
    private static IResult BadBody() => Fail(400, "Некорректный запрос");
    private static bool StringOrNull(ManagementInput input, string name) => !input.Has(name) || input.Value(name)?.ValueKind is System.Text.Json.JsonValueKind.String or System.Text.Json.JsonValueKind.Null;

    public static void MapAdaptiveEndpoints(this WebApplication app)
    {
        var course = app.MapGroup("/api/courses/{id}").RequireAuthorization().AddEndpointFilter<AdaptiveScopeFilter>();
        course.MapGet("/skills", async (HttpContext http, AdaptiveEngine engine) => Results.Ok(await engine.SkillInfos(Current(http), http.RequestAborted)))
            .Produces<SkillInfo[]>();
        course.MapPost("/skills", AddSkill).WithMetadata(new AdaptiveTeacherOnly());
        course.MapPatch("/skills/{skillId}", PatchSkill).WithMetadata(new AdaptiveTeacherOnly());
        course.MapDelete("/skills/{skillId}", DeleteSkill).WithMetadata(new AdaptiveTeacherOnly());
        course.MapPost("/skills/import", ImportSkills).WithMetadata(new AdaptiveTeacherOnly());
        course.MapPut("/activities/{activityId}/skills", LinkSkills).WithMetadata(new AdaptiveTeacherOnly());
        course.MapGet("/quizzes/{activityId}/questions", GetQuestions);
        course.MapPut("/quizzes/{activityId}/questions", PutQuestions).WithMetadata(new AdaptiveTeacherOnly());
        course.MapPost("/quizzes/{activityId}/attempts", StartAttempt).WithMetadata(new AdaptiveStudentOnly());
        course.MapGet("/quizzes/{activityId}/attempts", Attempts).WithMetadata(new AdaptiveStudentOnly()).Produces<AttemptsSummary>();
        course.MapGet("/adaptive", Dashboard).WithMetadata(new AdaptiveTeacherOnly());
        course.MapPatch("/adaptive", ToggleAdaptive).WithMetadata(new AdaptiveTeacherOnly());
        course.MapPut("/adaptive/students/{userId}/skills/{skillId}", OverrideSkill).WithMetadata(new AdaptiveTeacherOnly());
        course.MapPut("/adaptive/students/{userId}/pin", Pin).WithMetadata(new AdaptiveTeacherOnly());
        course.MapGet("/events", Events);
        var attempts = app.MapGroup("/api/attempts/{attemptId}").RequireAuthorization().AddEndpointFilter<AdaptiveScopeFilter>().WithMetadata(new AdaptiveStudentOnly());
        attempts.MapPost("/answers", Answer);
        attempts.MapPost("/hint", Hint);
        attempts.MapPost("/submit", Submit);
        var me = app.MapGroup("/api/me").RequireAuthorization().AddEndpointFilter<AdaptiveScopeFilter>().WithMetadata(new AdaptiveStudentOnly());
        me.MapGet("/courses/{id}/progress", async (HttpContext http, AdaptiveEngine engine) => Results.Ok(await engine.Progress(Current(http), Actor(http).Id, http.RequestAborted)));
        me.MapGet("/courses/{id}/next", async (HttpContext http, AdaptiveEngine engine) => Results.Json(await engine.Next(Current(http), Actor(http).Id, http.RequestAborted), AdaptiveJson.Options));
        me.MapPost("/recommendations/{recommendationId}", ReactRecommendation);
        me.MapPost("/courses/{id}/events", RecordEvent);
    }

    private static async Task<(Dictionary<string, string> Errors, string[] Prerequisites)> SkillErrors(
        ManagementInput input, Course course, LearningDbContext db, string? skillId, CancellationToken token)
    {
        var errors = new Dictionary<string, string>();
        var partial = skillId is not null;
        if ((!partial || input.Has("title")) && input.Text("title").Length is < 2 or > 200)
            errors["title"] = "Название навыка — от 2 до 200 символов";
        if (!StringOrNull(input, "code") || input.Text("code").Length > 20) errors["code"] = "Код — до 20 символов";
        if (!StringOrNull(input, "description") || input.Text("description").Length > 1000) errors["description"] = "Описание — до 1000 символов";
        if (!StringOrNull(input, "sectionId") || input.OptionalText("sectionId") is { } sectionId && course.Sections.All(section => section.Id != sectionId))
            errors["sectionId"] = "Такого модуля нет";
        var prerequisites = input.Has("prerequisiteIds") ? input.Ids("prerequisiteIds") : [];
        var ids = await db.Skills.Where(skill => skill.CourseId == course.Id).Select(skill => skill.Id).ToListAsync(token);
        if (prerequisites is null || prerequisites.Any(id => !ids.Contains(id)))
            errors["prerequisiteIds"] = "Пререквизит должен быть навыком этого курса";
        else if (skillId is not null && input.Has("prerequisiteIds"))
        {
            var edges = await db.SkillPrerequisites.Where(item => ids.Contains(item.SkillId)).ToListAsync(token);
            var graph = edges.Where(item => item.SkillId != skillId).GroupBy(item => item.SkillId).ToDictionary(group => group.Key, group => group.Select(item => item.RequiresSkillId).ToArray());
            graph[skillId] = prerequisites;
            bool Reaches(string id, HashSet<string> visited) => id == skillId || visited.Add(id) && graph.TryGetValue(id, out var children) && children.Any(child => Reaches(child, visited));
            if (prerequisites.Any(id => Reaches(id, []))) errors["prerequisiteIds"] = "Пререквизиты не должны образовывать цикл";
        }
        return (errors, prerequisites ?? []);
    }

    private static void ApplySkill(Skill skill, ManagementInput input)
    {
        if (input.Has("title")) skill.Title = input.Text("title");
        if (input.Has("code")) skill.Code = input.OptionalText("code");
        if (input.Has("description")) skill.Description = input.OptionalText("description");
        if (input.Has("sectionId")) skill.SectionId = input.OptionalText("sectionId");
    }

    private static async Task<IResult> AddSkill(HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input is null) return BadBody();
        var course = Current(http); var token = http.RequestAborted;
        var (errors, prerequisites) = await SkillErrors(input, course, db, null, token);
        if (errors.Count > 0) return Invalid(errors);
        var maxOrder = await db.Skills.Where(skill => skill.CourseId == course.Id).Select(skill => (int?)skill.Order).MaxAsync(token) ?? 0;
        var skill = new Skill { Id = AdaptiveEngine.Id("sk"), CourseId = course.Id, Order = maxOrder + 1 };
        ApplySkill(skill, input);
        db.Skills.Add(skill);
        foreach (var required in prerequisites) db.SkillPrerequisites.Add(new SkillPrerequisite { SkillId = skill.Id, RequiresSkillId = required });
        AuditLog.Write(db, http, "skill.created", "skill", skill.Id, $"{course.Code} · {skill.Title}");
        await TeacherCourseChange(http, db, engine, "skill.create", token);
        await db.SaveChangesAsync(token);
        return Results.Json((await engine.SkillInfos(course, token, ensureAuto: false)).Single(item => item.Id == skill.Id), statusCode: 201);
    }

    private static async Task<IResult> PatchSkill(string skillId, HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var course = Current(http); var token = http.RequestAborted;
        var skill = await db.Skills.SingleOrDefaultAsync(item => item.Id == skillId && item.CourseId == course.Id, token);
        if (skill is null) return Fail(404, "Навык не найден");
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input is null) return BadBody();
        var (errors, prerequisites) = await SkillErrors(input, course, db, skillId, token);
        if (errors.Count > 0) return Invalid(errors);
        ApplySkill(skill, input);
        if (input.Has("prerequisiteIds"))
        {
            var old = await db.SkillPrerequisites.Where(item => item.SkillId == skillId).ToListAsync(token);
            db.SkillPrerequisites.RemoveRange(old.Where(item => !prerequisites.Contains(item.RequiresSkillId)));
            foreach (var required in prerequisites.Where(id => old.All(item => item.RequiresSkillId != id)))
                db.SkillPrerequisites.Add(new SkillPrerequisite { SkillId = skillId, RequiresSkillId = required });
        }
        AuditLog.Write(db, http, "skill.updated", "skill", skill.Id, $"{course.Code} · {skill.Title}");
        await TeacherCourseChange(http, db, engine, "skill.update", token);
        await db.SaveChangesAsync(token);
        return Results.Ok((await engine.SkillInfos(course, token, ensureAuto: false)).Single(item => item.Id == skill.Id));
    }

    private static async Task<IResult> DeleteSkill(string skillId, HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var token = http.RequestAborted; var course = Current(http);
        var skill = await db.Skills.SingleOrDefaultAsync(item => item.Id == skillId && item.CourseId == course.Id, token);
        if (skill is null) return Fail(404, "Навык не найден");
        if (await db.SkillMastery.AnyAsync(item => item.SkillId == skillId, token)) return Fail(409, "По навыку уже есть результаты учеников");
        db.Skills.Remove(skill);
        AuditLog.Write(db, http, "skill.deleted", "skill", skill.Id, $"{course.Code} · {skill.Title}");
        await TeacherCourseChange(http, db, engine, "skill.delete", token);
        return Results.NoContent();
    }

    private static async Task<IResult> ImportSkills(HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input is null) return BadBody();
        var course = Current(http); var token = http.RequestAborted;
        var lines = input.Text("text").Split('\n').Select(line => line.Trim()).Where(line => line.Length > 0).ToArray();
        if (lines.Length is < 1 or > 50) return Invalid(new() { ["text"] = "От 1 до 50 строк навыков" });
        var parsed = new List<(ManagementInput Input, string[] Prerequisites)>();
        var errors = new Dictionary<string, string>();
        for (var i = 0; i < lines.Length; i++)
        {
            var match = Regex.Match(lines[i], @"^([\p{L}]+-\d+(?:\.\d+)*)\s+(.*)$", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
            var item = new ManagementInput(AdaptiveJson.Pack(new { title = match.Success ? match.Groups[2].Value : lines[i],
                code = match.Success ? match.Groups[1].Value : null, sectionId = input.Value("sectionId") }));
            var (itemErrors, prerequisites) = await SkillErrors(item, course, db, null, token);
            foreach (var error in itemErrors) errors[$"skills.{i}.{error.Key}"] = error.Value;
            parsed.Add((item, prerequisites));
        }
        if (errors.Count > 0) return Invalid(errors);
        var order = await db.Skills.Where(skill => skill.CourseId == course.Id).Select(skill => (int?)skill.Order).MaxAsync(token) ?? 0;
        var ids = new List<string>();
        foreach (var (item, _) in parsed)
        {
            var skill = new Skill { Id = AdaptiveEngine.Id("sk"), CourseId = course.Id, Order = ++order };
            ApplySkill(skill, item); ids.Add(skill.Id); db.Skills.Add(skill);
        }
        AuditLog.Write(db, http, "skill.imported", "course", course.Id, $"{course.Code} · {course.Title}",
            AuditLog.Diff(("Добавлено навыков", null, ids.Count.ToString())));
        await TeacherCourseChange(http, db, engine, "skill.import", token);
        await db.SaveChangesAsync(token);
        return Results.Json((await engine.SkillInfos(course, token, ensureAuto: false)).Where(item => ids.Contains(item.Id)), statusCode: 201);
    }

    private static async Task<IResult> LinkSkills(string activityId, HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var course = Current(http); var token = http.RequestAborted;
        if (!AdaptiveEngine.Materials(course).Any(item => item.Activity.Id == activityId)) return Fail(404, "Материал не найден");
        var input = await ManagementInput.ReadAsync(http.Request);
        var ids = input?.Ids("skillIds");
        if (ids is null || await db.Skills.CountAsync(skill => skill.CourseId == course.Id && ids.Contains(skill.Id), token) != ids.Length)
            return Invalid(new() { ["skillIds"] = "Навык должен быть из этого курса" });
        var old = await db.ActivitySkills.Where(item => item.CourseId == course.Id && item.ActivityId == activityId).ToListAsync(token);
        db.ActivitySkills.RemoveRange(old.Where(item => !ids.Contains(item.SkillId)));
        foreach (var id in ids.Where(id => old.All(item => item.SkillId != id)))
            db.ActivitySkills.Add(new ActivitySkill { CourseId = course.Id, ActivityId = activityId, SkillId = id });
        var titles = await db.Skills.Where(skill => skill.CourseId == course.Id).ToDictionaryAsync(skill => skill.Id, skill => skill.Title, token);
        string Titles(IEnumerable<string> skillIds) => string.Join(", ", skillIds.Select(id => titles.GetValueOrDefault(id, id)).Order());
        var activityTitle = AdaptiveEngine.Materials(course).First(item => item.Activity.Id == activityId).Activity.Title;
        var changes = AuditLog.Diff(("Навыки", Titles(old.Select(item => item.SkillId)), Titles(ids)));
        if (changes.Count > 0) AuditLog.Write(db, http, "activity.skills", "activity", activityId, $"{course.Code} · {activityTitle}", changes);
        await TeacherCourseChange(http, db, engine, "activity.skills", token);
        return Results.Ok(new { activityId, skillIds = ids });
    }

    private static async Task TeacherCourseChange(HttpContext http, LearningDbContext db, AdaptiveEngine engine, string action, CancellationToken token)
    {
        var courseId = Current(http).Id;
        foreach (var student in await AccessRules.CourseStudents(db, courseId).Select(account => account.Id).ToListAsync(token))
            await engine.Override(student, Actor(http).Id, courseId, action, "Изменены настройки обучения курса", token);
    }
}
