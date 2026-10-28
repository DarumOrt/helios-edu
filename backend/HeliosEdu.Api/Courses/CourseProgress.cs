using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Courses;

/// <summary>Числа карточки курса для того, кто смотрит: участники, прогресс, пройденные материалы.</summary>
/// <param name="Enrolled">студенты групп, которым назначен курс</param>
/// <param name="Progress">ученику — свой прогресс; преподавателю и управлению — средний по ученикам (нет учеников — null)</param>
/// <param name="Completed">только ученику — какие материалы он прошёл</param>
public sealed record CourseStats(int Enrolled, int? Progress, IReadOnlySet<string>? Completed)
{
    public static readonly CourseStats Empty = new(0, null, null);
}

// Прогресс по формуле P5 (docs/backend/p5-adaptive.md, раздел 2.3; AdaptiveEngine.Progress), но только на чтение:
// модуль без навыков считается одним неосвоенным авто-навыком, как если бы P5 его уже создал.
// Пройден материал — завершён просмотр (activity.completed или трекинг), сдан тест или сдана работа.
public static class CourseProgress
{
    public static async Task<Dictionary<string, CourseStats>> ForViewer(LearningDbContext db, Account viewer,
        IReadOnlyCollection<string> courseIds, CancellationToken token)
    {
        var courses = await db.Courses.AsNoTracking().AsSplitQuery()
            .Include(course => course.Sections).ThenInclude(section => section.Activities)
            .Where(course => courseIds.Contains(course.Id)).ToListAsync(token);
        var students = await StudentsByCourse(db, courseIds, token);
        var result = new Dictionary<string, CourseStats>();
        foreach (var course in courses)
        {
            var enrolled = students.GetValueOrDefault(course.Id) ?? [];
            if (viewer.Role == "student")
            {
                var mine = (await ForUsers(db, course, [viewer.Id], token))[viewer.Id];
                result[course.Id] = new CourseStats(enrolled.Count, mine.Progress, mine.Done);
            }
            else
            {
                var all = await ForUsers(db, course, enrolled, token);
                int? average = all.Count == 0 ? null
                    : (int)Math.Round(all.Values.Average(item => item.Progress), MidpointRounding.AwayFromZero);
                result[course.Id] = new CourseStats(enrolled.Count, average, null);
            }
        }
        return result;
    }

    /// <summary>Ученики курса — студенты групп, которым он назначен (как AccessRules.VisibleCourses).</summary>
    private static async Task<Dictionary<string, List<string>>> StudentsByCourse(LearningDbContext db,
        IReadOnlyCollection<string> courseIds, CancellationToken token)
    {
        var rows = await (from link in db.CohortCourses
                          join cohort in db.Cohorts on link.CohortId equals cohort.Id
                          join account in db.Accounts on new { cohort.TenantId, Group = cohort.Name }
                              equals new { account.TenantId, Group = account.Group! }
                          where courseIds.Contains(link.CourseId) && account.Role == "student"
                          select new { link.CourseId, account.Id }).Distinct().ToListAsync(token);
        return rows.GroupBy(row => row.CourseId).ToDictionary(group => group.Key, group => group.Select(row => row.Id).ToList());
    }

    /// <summary>Прогресс и пройденные материалы учеников курса (тем же правилом пользуется лидерборд).</summary>
    public static async Task<Dictionary<string, (int Progress, HashSet<string> Done)>> ForUsers(LearningDbContext db,
        Course course, IReadOnlyCollection<string> userIds, CancellationToken token)
    {
        var materials = course.Sections.SelectMany(section => section.Activities).ToList();
        var materialIds = materials.Select(activity => activity.Id).ToHashSet();
        var skills = await db.Skills.AsNoTracking().Where(skill => skill.CourseId == course.Id)
            .Select(skill => new { skill.Id, skill.SectionId }).ToListAsync(token);
        var skillCount = skills.Count + course.Sections.Count(section => skills.All(skill => skill.SectionId != section.Id));
        var skillIds = skills.Select(skill => skill.Id).ToList();
        var mastered = await db.SkillMastery.AsNoTracking()
            .Where(row => userIds.Contains(row.UserId) && skillIds.Contains(row.SkillId) && row.Status == "mastered")
            .GroupBy(row => row.UserId).Select(group => new { group.Key, Count = group.Count() })
            .ToDictionaryAsync(row => row.Key, row => row.Count, token);

        var done = userIds.ToDictionary(id => id, _ => new HashSet<string>());
        void Add(string userId, string activityId)
        {
            if (materialIds.Contains(activityId)) done[userId].Add(activityId);
        }
        foreach (var row in await db.LearningEvents.AsNoTracking().Where(item => item.CourseId == course.Id &&
                     item.Type == "activity.completed" && userIds.Contains(item.UserId) && item.ActivityId != null)
                     .Select(item => new { item.UserId, item.ActivityId }).Distinct().ToListAsync(token))
            Add(row.UserId, row.ActivityId!);
        foreach (var row in await db.QuizAttempts.AsNoTracking().Where(item => item.CourseId == course.Id &&
                     item.SubmittedAt != null && userIds.Contains(item.UserId))
                     .Select(item => new { item.UserId, item.ActivityId }).Distinct().ToListAsync(token))
            Add(row.UserId, row.ActivityId);
        foreach (var row in await db.Submissions.AsNoTracking().Where(item => item.CourseId == course.Id &&
                     userIds.Contains(item.UserId)).Select(item => new { item.UserId, item.ActivityId }).ToListAsync(token))
            Add(row.UserId, row.ActivityId);
        foreach (var row in await db.ActivityProgress.AsNoTracking().Where(item => item.CourseId == course.Id &&
                     item.Completed && userIds.Contains(item.UserId)).Select(item => new { item.UserId, item.ActivityId }).ToListAsync(token))
            Add(row.UserId, row.ActivityId);

        var hasQuiz = materials.Any(activity => activity.Type == "quiz");
        return userIds.ToDictionary(id => id, id =>
        {
            var materialShare = materials.Count == 0 ? 0 : (double)done[id].Count / materials.Count;
            var skillShare = skillCount == 0 ? 0 : (double)mastered.GetValueOrDefault(id) / skillCount;
            var progress = (int)Math.Round(100 * (hasQuiz ? .7 * skillShare + .3 * materialShare : materialShare),
                MidpointRounding.AwayFromZero);
            return (progress, done[id]);
        });
    }
}
