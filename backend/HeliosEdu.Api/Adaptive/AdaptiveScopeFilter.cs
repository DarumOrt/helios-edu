using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Adaptive;

public sealed record AdaptiveTeacherOnly;
public sealed record AdaptiveStudentOnly;

// Все изменения (включая ленивые GET) сериализуются тем же замком курса, что и P2.
public sealed class AdaptiveScopeFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext invocation, EndpointFilterDelegate next)
    {
        var http = invocation.HttpContext;
        var db = http.RequestServices.GetRequiredService<LearningDbContext>();
        var actor = (Account)http.Items[typeof(Account)]!;
        var token = http.RequestAborted;
        if (!HttpMethods.IsGet(http.Request.Method) && http.Request.Headers["X-Helios-Client"] != "web")
            return Fail(403, "Недостаточно прав");
        if (http.GetEndpoint()?.Metadata.GetMetadata<AdaptiveTeacherOnly>() is not null && actor.Role == "student")
            return Fail(403, "Недостаточно прав");
        if (http.GetEndpoint()?.Metadata.GetMetadata<AdaptiveStudentOnly>() is not null && actor.Role != "student")
            return Fail(403, "Недостаточно прав");
        var courseId = http.Request.RouteValues["id"]?.ToString();
        if (http.Request.RouteValues["attemptId"]?.ToString() is { } attemptId)
        {
            var attempt = await db.QuizAttempts.AsNoTracking().SingleOrDefaultAsync(item => item.Id == attemptId && item.UserId == actor.Id, token);
            if (attempt is null) return Fail(404, "Попытка не найдена");
            courseId = attempt.CourseId;
        }
        if (http.Request.RouteValues["recommendationId"]?.ToString() is { } recommendationId)
        {
            var recommendation = await db.Recommendations.AsNoTracking().SingleOrDefaultAsync(item => item.Id == recommendationId && item.UserId == actor.Id, token);
            if (recommendation is null) return Fail(404, "Рекомендация не найдена");
            courseId = recommendation.CourseId;
        }
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        var exists = await db.Database.SqlQuery<string>($"SELECT \"Id\" AS \"Value\" FROM \"Courses\" WHERE \"Id\" = {courseId} FOR UPDATE").SingleOrDefaultAsync(token);
        if (exists is null) return Fail(404, "Курс не найден");
        var course = await db.Courses.Include(item => item.Sections.OrderBy(section => section.Order))
            .ThenInclude(section => section.Activities.OrderBy(activity => EF.Property<int>(activity, "Position")))
            .AsSplitQuery().SingleAsync(item => item.Id == courseId, token);
        if (actor.Role == "student")
        {
            var enrolled = await AccessRules.IsCourseStudent(db, actor, course.Id, token);
            if (!enrolled) return http.Request.Path.StartsWithSegments("/api/me") || http.Request.Path.StartsWithSegments("/api/attempts")
                ? Fail(403, "Вы не записаны на этот курс") : Fail(404, "Курс не найден");
            if (course.Status != "published") return Fail(404, "Курс не найден");
        }
        else if (!AccessRules.CanEditCourse(actor, course)) return Fail(404, "Курс не найден");
        http.Items[typeof(Course)] = course;
        var result = await next(invocation);
        if (result is IStatusCodeHttpResult { StatusCode: >= 400 }) await transaction.RollbackAsync(token);
        else { await db.SaveChangesAsync(token); await transaction.CommitAsync(token); }
        return result;
    }
}
