using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Management;

public static partial class ManagementEndpoints
{
    private static async Task ValidateCourseGroups(ManagementInput input, HttpContext context,
        LearningDbContext db, Dictionary<string, string> fields)
    {
        if (!input.Has("cohortIds")) return;
        var ids = input.Ids("cohortIds");
        if (ids is null || input.Value("cohortIds")!.Value.GetArrayLength() > 200 || await db.Cohorts.CountAsync(g =>
                ids.Contains(g.Id) && g.TenantId == Actor(context).TenantId, context.RequestAborted) != ids.Length)
            fields["cohortIds"] = "Выберите существующие группы (не более 200)";
    }

    private static async Task SetCourseGroups(ManagementInput input, Course course, HttpContext context, LearningDbContext db)
    {
        if (input.Ids("cohortIds") is not { } ids) return;
        // Тот же порядок блокировок, что у управления группами: группы, затем связи.
        foreach (var id in ids.Order())
            await FindCohort(db, id, Actor(context).TenantId, true, context.RequestAborted);
        // Разные выбранные группы не должны позволять двум PATCH объединить два полных списка.
        if (db.Entry(course).State != EntityState.Added)
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM \"Courses\" WHERE \"Id\" = {course.Id} FOR UPDATE", context.RequestAborted);
        var current = await db.CohortCourses.Where(l => l.CourseId == course.Id &&
            db.Cohorts.Any(g => g.Id == l.CohortId && g.TenantId == Actor(context).TenantId))
            .ToListAsync(context.RequestAborted);
        db.CohortCourses.RemoveRange(current.Where(l => !ids.Contains(l.CohortId)));
        foreach (var id in ids.Where(id => current.All(l => l.CohortId != id)))
            db.CohortCourses.Add(new CohortCourse { CohortId = id, CourseId = course.Id, Position = 100000 });
        if (!current.Select(l => l.CohortId).Order().SequenceEqual(ids.Order()))
            Audit.AuditLog.Write(db, context, "course.updated", "course", course.Id, course.Title,
                [new Audit.AuditChange("Группы", string.Join(", ", current.Select(l => l.CohortId)), string.Join(", ", ids))]);
    }
}
