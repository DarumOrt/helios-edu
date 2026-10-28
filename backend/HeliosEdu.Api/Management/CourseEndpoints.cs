using HeliosEdu.Api.Audit;
using System.Security.Cryptography;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Management;

public static partial class ManagementEndpoints
{
    private static void MapCourses(WebApplication app)
    {
        var courses = app.MapGroup("/api/courses").RequireAuthorization(AccessRules.ManageCourses)
            .AddEndpointFilter<ManagementWriteFilter>();
        courses.MapPost("", CreateCourseAsync);
        // карточку правит и преподаватель — только своего курса и без полей управления (ManagedCourseFields)
        app.MapGroup("/api/courses").RequireAuthorization(AccessRules.EditCourse)
            .AddEndpointFilter<ManagementWriteFilter>().MapPatch("/{id}", UpdateCourseAsync);
    }

    /// <summary>Поля карточки, которые меняет только управление: преподавателя курса, факультет и учебный год.</summary>
    private static readonly string[] ManagedCourseFields = ["tutorId", "faculty", "academicYear"];

    private static async Task ValidateTutor(ManagementInput input, bool partial, HttpContext context, LearningDbContext db,
        Dictionary<string, string> fields)
    {
        if ((!partial || input.Has("tutorId")) && !fields.ContainsKey("tutorId") &&
            !await db.Accounts.AnyAsync(user => user.Id == input.Text("tutorId") && user.Role == "tutor" && user.TenantId == Actor(context).TenantId,
                context.RequestAborted)) fields["tutorId"] = "Выберите преподавателя";
    }

    private static async Task<string?> TutorName(LearningDbContext db, string? tutorId, CancellationToken token) =>
        await db.Accounts.Where(user => user.Id == tutorId).Select(user => user.Name).SingleOrDefaultAsync(token);

    private static async Task<IResult> CreateCourseAsync(HttpContext context, LearningDbContext db)
    {
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var fields = ManagementValidation.Course(input, false);
        await ValidateTutor(input, false, context, db, fields);
        if (fields.Count > 0) return Invalid(fields);
        var code = input.Text("code").ToUpperInvariant();
        if (await db.Courses.AnyAsync(course => course.Code == code, context.RequestAborted))
            return Duplicate("code", "Курс с таким кодом уже есть");
        var course = new Course { Id = $"c-{Guid.NewGuid():N}", Code = code, Title = input.Text("title"),
            Category = input.Text("category"), Description = input.Text("description"), TutorId = input.Text("tutorId"),
            Status = "draft", CoverColor = CoverColors[RandomNumberGenerator.GetInt32(CoverColors.Length)],
            Faculty = input.OptionalText("faculty"), AcademicYear = input.OptionalText("academicYear") };
        var position = await db.Courses.MaxAsync(item => (int?)EF.Property<int>(item, "Position"), context.RequestAborted) ?? -1;
        db.Courses.Add(course);
        db.Entry(course).Property("Position").CurrentValue = position + 1;
        AuditLog.Write(db, context, "course.created", "course", course.Id, $"{course.Code} · {course.Title}",
            AuditLog.Diff(("Преподаватель", null, await TutorName(db, course.TutorId, context.RequestAborted))));
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Json(CourseSummary.From(course, CourseStats.Empty), statusCode: 201);
    }

    private static async Task<IResult> UpdateCourseAsync(string id, HttpContext context, LearningDbContext db)
    {
        var actor = Actor(context);
        // чужой курс преподавателю не виден — 404, как у GET
        var course = await AccessRules.VisibleCourses(db, context.User)
            .SingleOrDefaultAsync(course => course.Id == id, context.RequestAborted);
        if (course is null || !AccessRules.CanEditCourse(actor, course)) return Fail(404, "not found");
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        if (actor.Role == "tutor" && ManagedCourseFields.Any(input.Has))
            return Fail(403, "Преподавателя, факультет и учебный год курса меняет организатор");
        if (input.Has("code")) return Fail(400, "Код курса изменить нельзя", new() { ["code"] = "Код курса изменить нельзя" });
        var fields = ManagementValidation.Course(input, true);
        await ValidateTutor(input, true, context, db, fields);
        if (fields.Count > 0) return Invalid(fields);
        var before = (course.Title, course.Category, course.Description, course.Faculty, course.AcademicYear, course.Status,
            Tutor: await TutorName(db, course.TutorId, context.RequestAborted));
        if (input.Has("title")) course.Title = input.Text("title");
        if (input.Has("category")) course.Category = input.Text("category");
        if (input.Has("description")) course.Description = input.Text("description");
        if (input.Has("tutorId")) course.TutorId = input.Text("tutorId");
        if (input.Has("faculty")) course.Faculty = input.OptionalText("faculty");
        if (input.Has("academicYear")) course.AcademicYear = input.OptionalText("academicYear");
        if (input.Has("status")) course.Status = input.Choice("status");
        var changes = AuditLog.Diff(("Название", before.Title, course.Title), ("Направление", before.Category, course.Category),
            ("Описание", before.Description, course.Description),
            ("Преподаватель", before.Tutor, await TutorName(db, course.TutorId, context.RequestAborted)),
            ("Факультет", before.Faculty, course.Faculty), ("Учебный год", before.AcademicYear, course.AcademicYear),
            ("Статус", AuditLog.Status(before.Status), AuditLog.Status(course.Status)));
        if (changes.Count > 0)
            AuditLog.Write(db, context, "course.updated", "course", course.Id, $"{course.Code} · {course.Title}", changes);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(CourseSummary.From(course, (await CourseProgress.ForViewer(db,
            actor, [course.Id], context.RequestAborted))[course.Id]));
    }
}
