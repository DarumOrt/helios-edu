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
        courses.MapPatch("/{id}", UpdateCourseAsync);
    }

    private static async Task ValidateTutor(ManagementInput input, bool partial, HttpContext context, LearningDbContext db,
        Dictionary<string, string> fields)
    {
        if ((!partial || input.Has("tutorId")) && !fields.ContainsKey("tutorId") &&
            !await db.Accounts.AnyAsync(user => user.Id == input.Text("tutorId") && user.Role == "tutor" && user.TenantId == Actor(context).TenantId,
                context.RequestAborted)) fields["tutorId"] = "Выберите преподавателя";
    }

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
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Json(CourseSummary.From(course, CourseStats.Empty), statusCode: 201);
    }

    private static async Task<IResult> UpdateCourseAsync(string id, HttpContext context, LearningDbContext db)
    {
        var course = await db.Courses.SingleOrDefaultAsync(course => course.Id == id, context.RequestAborted);
        if (course is null) return Fail(404, "not found");
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        if (input.Has("code")) return Fail(400, "Код курса изменить нельзя", new() { ["code"] = "Код курса изменить нельзя" });
        var fields = ManagementValidation.Course(input, true);
        await ValidateTutor(input, true, context, db, fields);
        if (fields.Count > 0) return Invalid(fields);
        if (input.Has("title")) course.Title = input.Text("title");
        if (input.Has("category")) course.Category = input.Text("category");
        if (input.Has("description")) course.Description = input.Text("description");
        if (input.Has("tutorId")) course.TutorId = input.Text("tutorId");
        if (input.Has("faculty")) course.Faculty = input.OptionalText("faculty");
        if (input.Has("academicYear")) course.AcademicYear = input.OptionalText("academicYear");
        if (input.Has("status")) course.Status = input.Choice("status");
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(CourseSummary.From(course, (await CourseProgress.ForViewer(db,
            (Account)context.Items[typeof(Account)]!, [course.Id], context.RequestAborted))[course.Id]));
    }
}
