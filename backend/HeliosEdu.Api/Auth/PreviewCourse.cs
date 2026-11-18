using HeliosEdu.Api.Adaptive;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Files;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Auth;

internal static class PreviewCourse
{
    internal static async Task<bool> Create(LearningDbContext db, Guid previewId, string tenant, string? courseId, CancellationToken ct)
    {
        var tutor = RolePreview.Actor("tutor", tenant);
        var course = courseId == null ? Example() : await db.Courses.AsNoTracking().AsSplitQuery()
            .Include(c => c.Sections.OrderBy(s => s.Order))
            .ThenInclude(s => s.Activities.OrderBy(a => EF.Property<int>(a, "Position")))
            .SingleOrDefaultAsync(c => c.TenantId == tenant && c.Id == courseId && c.DeletedAt == null, ct);
        if (course == null) return false;
        var faculties = await db.Faculties.AsNoTracking().Where(f => f.TenantId == tenant).ToListAsync(ct);
        var skills = await db.Skills.AsNoTracking().Where(s => s.CourseId == courseId).ToListAsync(ct);
        var skillIds = skills.Select(s => s.Id).ToArray();
        var prerequisites = await db.SkillPrerequisites.AsNoTracking().Where(p => skillIds.Contains(p.SkillId) &&
            skillIds.Contains(p.RequiresSkillId)).ToListAsync(ct);
        var links = await db.ActivitySkills.AsNoTracking().Where(l => l.CourseId == courseId).ToListAsync(ct);
        var questions = await db.QuizQuestions.AsNoTracking().Where(q => q.CourseId == courseId).ToListAsync(ct);
        if (courseId == null) questions.Add(new QuizQuestion { Id = "example-question", CourseId = course.Id,
            ActivityId = "quiz", Type = "boolean", Text = "Курс состоит из учебных материалов.",
            Correct = AdaptiveJson.Pack(true), Order = 1 });
        var files = await db.Files.AsNoTracking().Where(f => f.CourseId == courseId && f.Status == "ready" &&
            f.Kind != FileKinds.Submission.Name).ToListAsync(ct);

        // Имя состоит из фиксированного префикса и серверного Guid. Модель EF создаёт собственные FK и индексы.
        var schema = RolePreview.Schema(previewId);
        var ddl = db.Database.GenerateCreateScript();
#pragma warning disable EF1003 // Имя схемы состоит только из префикса и серверного GUID.
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA " + schema, ct);
#pragma warning restore EF1003
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT set_config('search_path', {schema}, true)", ct);
        await db.Database.ExecuteSqlRawAsync(ddl, ct);
        course.TenantId = tenant;
        course.TutorId = tutor.Id;
        course.Status = "published";
        course.EnrollmentKeyHash = null;
        foreach (var file in files) file.OwnerId = tutor.Id;

        db.Faculties.AddRange(faculties);
        db.Accounts.AddRange(tutor, RolePreview.Actor("student", tenant), RolePreview.Actor("organizer", tenant));
        db.Courses.Add(course);
        foreach (var section in course.Sections)
            for (var i = 0; i < section.Activities.Count; i++)
                db.Entry(section.Activities[i]).Property("Position").CurrentValue = i;
        db.Cohorts.Add(new Cohort { Id = "preview-group", TenantId = tenant, Name = RolePreview.Group,
            NormalizedName = RolePreview.Group.ToUpperInvariant(), Faculty = course.Faculty });
        db.CohortCourses.Add(new CohortCourse { CohortId = "preview-group", CourseId = course.Id });
        db.Skills.AddRange(skills);
        db.SkillPrerequisites.AddRange(prerequisites);
        db.ActivitySkills.AddRange(links);
        db.QuizQuestions.AddRange(questions);
        db.Files.AddRange(files);
        await db.SaveChangesAsync(ct);
        return true;
    }

    private static Course Example() => new()
    {
        Id = "preview-course", Code = "ПРБ-101", Title = "Курс для проверки ролей", Category = "Практика",
        Description = "Здесь можно пройти тест, отправить работу и проверить её в роли преподавателя.",
        TutorId = "preview-tutor", Sections = [new Section { Id = "intro", Title = "Практика", Order = 1,
            Activities = [new Activity { Id = "quiz", Title = "Проверочный тест", Type = "quiz", MaxGrade = 10 },
                new Activity { Id = "assignment", Title = "Проверочная работа", Type = "assignment", MaxGrade = 10 }] }]
    };
}
