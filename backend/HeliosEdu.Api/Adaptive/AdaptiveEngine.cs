using System.Globalization;
using System.Text.Json;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Adaptive;

public static class AdaptiveJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public static JsonElement Pack<T>(T value) => JsonSerializer.SerializeToElement(value, Options);
    public static T Read<T>(JsonElement value) => value.Deserialize<T>(Options)!;
}

public sealed class AdaptiveEngine(LearningDbContext db)
{
    public static string Id(string prefix) => $"{prefix}-{Guid.NewGuid().ToString("N")[..8]}";
    public static IEnumerable<(Section Section, Activity Activity)> Materials(Course course) =>
        course.Sections.OrderBy(section => section.Order).SelectMany(section => section.Activities.Select(activity => (section, activity)));

    public void Event(string userId, string actorId, string courseId, string type, object payload,
        string? activityId = null, string? skillId = null) => db.LearningEvents.Add(new LearningEvent
        { At = DateTimeOffset.UtcNow, UserId = userId, ActorId = actorId, CourseId = courseId, Type = type,
            Payload = AdaptiveJson.Pack(payload), ActivityId = activityId, SkillId = skillId });

    public async Task<List<Skill>> EnsureSkills(Course course, CancellationToken token, string? sectionId = null)
    {
        var skills = await db.Skills.Where(skill => skill.CourseId == course.Id).OrderBy(skill => skill.Order).ThenBy(skill => skill.Id).ToListAsync(token);
        foreach (var section in course.Sections.Where(section => sectionId is null || section.Id == sectionId).OrderBy(section => section.Order))
        {
            if (skills.Any(skill => skill.SectionId == section.Id)) continue;
            var skill = new Skill { Id = Id("sk"), CourseId = course.Id, SectionId = section.Id,
                Title = section.Title.Length <= 200 ? section.Title : section.Title[..200], IsAuto = true,
                Order = skills.Count == 0 ? 1 : skills.Max(item => item.Order) + 1 };
            skills.Add(skill);
            db.Skills.Add(skill);
        }
        await db.SaveChangesAsync(token);
        return skills;
    }

    public async Task<SkillInfo[]> SkillInfos(Course course, CancellationToken token, bool ensureAuto = true)
    {
        var skills = ensureAuto ? await EnsureSkills(course, token) : await db.Skills.Where(skill => skill.CourseId == course.Id)
            .OrderBy(skill => skill.Order).ThenBy(skill => skill.Id).ToListAsync(token);
        var ids = skills.Select(skill => skill.Id).ToArray();
        var prerequisites = await db.SkillPrerequisites.Where(item => ids.Contains(item.SkillId)).ToListAsync(token);
        var links = await db.ActivitySkills.Where(item => item.CourseId == course.Id).ToListAsync(token);
        return skills.Select(skill => new SkillInfo(skill.Id, skill.CourseId, skill.SectionId, skill.Code, skill.Title,
            skill.Description, skill.Order, skill.IsAuto, skill.PInit, skill.PLearn, skill.PSlip, skill.PGuess,
            prerequisites.Where(item => item.SkillId == skill.Id).Select(item => item.RequiresSkillId).Order().ToArray(),
            links.Where(item => item.SkillId == skill.Id).Select(item => item.ActivityId).Order().ToArray())).ToArray();
    }

    public static string[] QuestionSkills(QuizQuestion question, Course course, IEnumerable<Skill> skills, IEnumerable<ActivitySkill> links)
    {
        if (question.SkillId is { } id) return [id];
        return MaterialSkills(course, question.ActivityId, skills, links);
    }

    public static string[] MaterialSkills(Course course, string activityId, IEnumerable<Skill> skills, IEnumerable<ActivitySkill> links)
    {
        var explicitIds = links.Where(link => link.CourseId == course.Id && link.ActivityId == activityId).Select(link => link.SkillId).Distinct().ToArray();
        if (explicitIds.Length > 0) return explicitIds;
        var section = course.Sections.Find(section => section.Activities.Any(activity => activity.Id == activityId));
        return section is null ? [] : skills.Where(skill => skill.SectionId == section.Id).Select(skill => skill.Id).ToArray();
    }

    public async Task<Dictionary<string, SkillMastery>> Masteries(string userId, List<Skill> skills, CancellationToken token)
    {
        var ids = skills.Select(skill => skill.Id).ToArray();
        var rows = await db.SkillMastery.Where(item => item.UserId == userId && ids.Contains(item.SkillId)).ToDictionaryAsync(item => item.SkillId, token);
        var prerequisites = await db.SkillPrerequisites.Where(item => ids.Contains(item.SkillId)).ToListAsync(token);
        // Отсутствующая строка — вычисляемое начальное состояние, без лишней записи в БД.
        foreach (var skill in skills)
            if (!rows.ContainsKey(skill.Id)) rows[skill.Id] = new SkillMastery
                { UserId = userId, SkillId = skill.Id, PKnown = skill.PInit, UpdatedAt = DateTimeOffset.UtcNow };
        RefreshStatuses(rows, prerequisites);
        return rows;
    }

    private static void RefreshStatuses(Dictionary<string, SkillMastery> rows, List<SkillPrerequisite> prerequisites)
    {
        foreach (var row in rows.Values)
        {
            if (row.Status == "mastered") continue;
            var status = row.UnlockedByTeacher || prerequisites.Where(item => item.SkillId == row.SkillId)
                .All(item => rows.TryGetValue(item.RequiresSkillId, out var required) && required.Status == "mastered") ? "learning" : "locked";
            if (row.Status == status) continue;
            row.Status = status;
            row.UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    public static double Bkt(double p, Skill skill, QuizQuestion question, bool correct, int hints)
    {
        var guess = question.Type switch { "mcq" => 1d / question.Options.GetArrayLength(), "boolean" => .5, "short" => .05, _ => skill.PGuess };
        var positive = correct && hints == 0;
        var numerator = p * (positive ? 1 - skill.PSlip : skill.PSlip);
        var denominator = numerator + (1 - p) * (positive ? guess : 1 - guess);
        var posterior = denominator == 0 ? p : numerator / denominator;
        return Math.Round(Math.Clamp(posterior + (1 - posterior) * skill.PLearn, 0, 1), 4, MidpointRounding.AwayFromZero);
    }

    public async Task<object[]> Learn(string userId, string courseId, QuizQuestion question, string[] skillIds,
        bool correct, int hints, CancellationToken token)
    {
        var skills = await db.Skills.Where(skill => skill.CourseId == courseId).ToListAsync(token);
        var rows = await Masteries(userId, skills, token);
        var changes = new List<(Skill Skill, double Before)>();
        foreach (var skill in skills.Where(skill => skillIds.Contains(skill.Id)))
        {
            var row = rows[skill.Id];
            if (db.Entry(row).State == EntityState.Detached) db.SkillMastery.Add(row);
            var before = row.PKnown;
            var wasMastered = row.Status == "mastered";
            row.PKnown = Bkt(before, skill, question, correct, hints);
            row.Attempts++;
            if (correct) row.Correct++;
            row.UpdatedAt = DateTimeOffset.UtcNow;
            if (row.PKnown >= .95 || wasMastered)
            {
                row.Status = "mastered";
                row.MasteredAt ??= row.UpdatedAt;
            }
            Event(userId, userId, courseId, "skill.updated", new { before, after = row.PKnown }, question.ActivityId, skill.Id);
            if (!wasMastered && row.Status == "mastered")
                Event(userId, userId, courseId, "skill.mastered", new { pKnown = row.PKnown }, question.ActivityId, skill.Id);
            changes.Add((skill, before));
        }
        var ids = skills.Select(skill => skill.Id).ToArray();
        RefreshStatuses(rows, await db.SkillPrerequisites.Where(item => ids.Contains(item.SkillId)).ToListAsync(token));
        return changes.Select(change => (object)new { skillId = change.Skill.Id, before = change.Before,
            after = rows[change.Skill.Id].PKnown, status = rows[change.Skill.Id].Status }).ToArray();
    }

    public async Task<HashSet<string>> Completed(string userId, string courseId, CancellationToken token)
    {
        var completed = await db.LearningEvents.Where(item => item.UserId == userId && item.CourseId == courseId && item.Type == "activity.completed")
            .Select(item => item.ActivityId!).Distinct().ToListAsync(token);
        completed.AddRange(await db.QuizAttempts.Where(item => item.UserId == userId && item.CourseId == courseId && item.SubmittedAt != null)
            .Select(item => item.ActivityId).Distinct().ToListAsync(token));
        return completed.ToHashSet();
    }

    public async Task<object> Progress(Course course, string userId, CancellationToken token)
    {
        var skills = await EnsureSkills(course, token);
        var rows = await Masteries(userId, skills, token);
        var materials = Materials(course).Select(item => item.Activity).ToArray();
        var completed = await Completed(userId, course.Id, token);
        var done = materials.Count(item => completed.Contains(item.Id));
        var materialShare = materials.Length == 0 ? 0 : (double)done / materials.Length;
        var skillShare = skills.Count == 0 ? 0 : (double)rows.Values.Count(row => row.Status == "mastered") / skills.Count;
        var progress = (int)Math.Round(100 * (materials.Any(item => item.Type == "quiz") ? .7 * skillShare + .3 * materialShare : materialShare), MidpointRounding.AwayFromZero);
        return new { progress, skills = skills.Select(skill => new { skill.Id, skill.Title, skill.Code,
            pKnown = rows[skill.Id].PKnown, status = rows[skill.Id].Status }), materials = new { done, total = materials.Length } };
    }

    public async Task Override(string userId, string actorId, string courseId, string action, string reason, CancellationToken token,
        string? activityId = null, string? skillId = null)
    {
        foreach (var recommendation in await db.Recommendations.Where(item => item.UserId == userId && item.CourseId == courseId && item.Status == "shown").ToListAsync(token))
            recommendation.Status = "overridden";
        Event(userId, actorId, courseId, "teacher.override", new { action, reason }, activityId, skillId);
    }

    public async Task<object> Next(Course course, string userId, CancellationToken token)
    {
        var skills = await EnsureSkills(course, token);
        var rows = await Masteries(userId, skills, token);
        var links = await db.ActivitySkills.Where(item => item.CourseId == course.Id).ToListAsync(token);
        var materials = Materials(course).Select(item => item.Activity).ToArray();
        var completed = await Completed(userId, course.Id, token);
        var learning = skills.Where(skill => rows[skill.Id].Status == "learning").OrderBy(skill => rows[skill.Id].PKnown)
            .ThenBy(skill => skill.Order).ThenBy(skill => skill.Id).ToArray();
        var personal = learning.Where(skill => rows[skill.Id].PKnown < .6).Select(skill => new { skillId = skill.Id,
            activityIds = materials.Where(material => material.Type is "video" or "pdf" or "presentation" && !completed.Contains(material.Id) &&
                MaterialSkills(course, material.Id, skills, links).Contains(skill.Id)).Select(material => material.Id).ToArray() }).ToArray();
        string? activityId = null, skillId = null;
        string code, reason;
        var pin = await db.StudentPins.SingleOrDefaultAsync(item => item.UserId == userId && item.CourseId == course.Id, token);
        if (pin is not null && materials.Any(item => item.Id == pin.ActivityId))
        { activityId = pin.ActivityId; code = "pinned_by_teacher"; reason = $"Задание назначил преподаватель: {pin.Reason}"; }
        else if (!course.AdaptiveEnabled)
        { activityId = materials.FirstOrDefault(item => !completed.Contains(item.Id))?.Id; code = "linear_order"; reason = "Следующий материал по порядку курса"; }
        else if (skills.Count > 0 && skills.All(skill => rows[skill.Id].Status == "mastered"))
        { code = "all_mastered"; reason = "Все навыки курса освоены"; }
        else if (learning.FirstOrDefault() is { } weakest)
        {
            skillId = weakest.Id;
            var questions = await db.QuizQuestions.Where(item => item.CourseId == course.Id).OrderBy(item => item.Order).ToListAsync(token);
            var attemptIds = await db.QuizAttempts.Where(item => item.UserId == userId && item.CourseId == course.Id).Select(item => item.Id).ToListAsync(token);
            var correctIds = (await db.AttemptAnswers.Where(item => attemptIds.Contains(item.AttemptId) && item.IsCorrect)
                .Select(item => new { item.AttemptId, item.QuestionId }).ToListAsync(token));
            var attempts = await db.QuizAttempts.Where(item => attemptIds.Contains(item.Id)).ToDictionaryAsync(item => item.Id, token);
            // Вопросы с одинаковым Id в разных тестах не смешиваются.
            var solved = correctIds.Select(item => $"{attempts[item.AttemptId].ActivityId}/{item.QuestionId}").ToHashSet();
            var relevant = questions.Where(question => QuestionSkills(question, course, skills, links).Contains(weakest.Id)).ToArray();
            var candidate = materials.Where(item => item.Type == "quiz").Select((item, position) => new { Activity = item, Position = position,
                Count = relevant.Count(question => question.ActivityId == item.Id),
                Correct = relevant.Count(question => question.ActivityId == item.Id && solved.Contains($"{item.Id}/{question.Id}")) })
                .Where(item => item.Count > 0 && item.Correct < item.Count).OrderByDescending(item => item.Count).ThenBy(item => item.Correct).ThenBy(item => item.Position).FirstOrDefault();
            if (candidate is not null)
            { activityId = candidate.Activity.Id; code = "weakest_skill"; reason = $"Навык «{weakest.Title}» освоен на {Math.Round(rows[weakest.Id].PKnown * 100).ToString(CultureInfo.InvariantCulture)}%, пререквизиты пройдены"; }
            else
            {
                var viewed = (await db.LearningEvents.Where(item => item.UserId == userId && item.CourseId == course.Id &&
                    (item.Type == "activity.viewed" || item.Type == "activity.completed")).Select(item => item.ActivityId!).ToListAsync(token)).ToHashSet();
                activityId = materials.FirstOrDefault(item => item.Type is "video" or "pdf" or "presentation" && !viewed.Contains(item.Id) && !completed.Contains(item.Id) &&
                    MaterialSkills(course, item.Id, skills, links).Contains(weakest.Id))?.Id;
                code = "review_material"; reason = activityId is null ? $"Для навыка «{weakest.Title}» нет доступного материала для повторения" : $"Повторите материал по навыку «{weakest.Title}»";
            }
        }
        else { code = "review_material"; reason = "Нет доступных заданий: проверьте пререквизиты навыков"; }
        var last = await db.Recommendations.Where(item => item.UserId == userId && item.CourseId == course.Id)
            .OrderByDescending(item => item.CreatedAt).ThenByDescending(item => item.Id).FirstOrDefaultAsync(token);
        if (last is null || last.Status != "shown" || last.ActivityId != activityId)
        {
            last = new Recommendation { Id = Id("rec"), UserId = userId, CourseId = course.Id, ActivityId = activityId,
                SkillId = skillId, ReasonCode = code, ReasonText = reason, CreatedAt = DateTimeOffset.UtcNow };
            db.Recommendations.Add(last);
            Event(userId, userId, course.Id, "recommendation.shown", new { recommendationId = last.Id, reason }, activityId, skillId);
        }
        await db.SaveChangesAsync(token);
        return new { recommendation = new { last.Id, last.ActivityId, last.SkillId, last.ReasonCode, last.ReasonText }, personal };
    }
}
