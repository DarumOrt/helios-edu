using System.Text.Json.Serialization;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;
using HeliosEdu.Api.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using System.Threading.RateLimiting;
using HeliosEdu.Api.Management;
using HeliosEdu.Api.Adaptive;
using HeliosEdu.Api.Grades;
using HeliosEdu.Api.Notifications;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("Database")
    ?? throw new InvalidOperationException("Задайте ConnectionStrings__Database для PostgreSQL.");

builder.Services.AddDbContext<LearningDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<AdaptiveEngine>();
// Описание API для генерации типов фронтенда (npm run api:types, docs/api/openapi.json).
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull);
builder.Services.AddProblemDetails();
builder.Services.AddScoped<IPasswordHasher<Account>, PasswordHasher<Account>>();
builder.Services.AddAuthentication(SessionAuthentication.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, SessionAuthentication>(SessionAuthentication.SchemeName, _ => { });
builder.Services.AddAuthorization(options =>
{
    foreach (var permission in new[] { AccessRules.ManageUsers, AccessRules.ManageCohorts, AccessRules.ManageCourses })
        options.AddPolicy(permission, policy => policy.RequireRole("admin", "organizer"));
    options.AddPolicy(AccessRules.ReadCohorts, policy => policy.RequireRole("admin", "organizer", "tutor"));
    options.AddPolicy(AccessRules.EditCourse, policy => policy.RequireRole("admin", "organizer", "tutor"));
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
        }));
});
var app = builder.Build();
app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    await next(context);
});
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapAuthEndpoints();
app.MapManagementEndpoints();
app.MapCourseBuilderEndpoints();
app.MapCatalogEndpoints();
app.MapAdaptiveEndpoints();
app.MapGradesEndpoints();
app.MapNotificationsEndpoints();
app.MapOpenApi();

// Миграции и моки включаются явно: production не должен заполняться демоданными.
if (app.Configuration.GetValue<bool>("Database:ApplyMigrations"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<LearningDbContext>();
    await db.Database.MigrateAsync();
    if (app.Configuration.GetValue<bool>("Database:SeedDemoData"))
        await DemoData.SeedAsync(db, app.Configuration, CancellationToken.None);
}

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/health/ready", async (LearningDbContext db, CancellationToken cancellationToken) =>
{
    try
    {
        // Проверяем и подключение, и наличие схемы после миграции.
        await db.Courses.AnyAsync(cancellationToken);
        await db.Accounts.AnyAsync(cancellationToken);
        await db.LoginSessions.AnyAsync(cancellationToken);
        await db.Enrollments.AnyAsync(cancellationToken);
        await db.Cohorts.AnyAsync(cancellationToken);
        await db.CohortCourses.AnyAsync(cancellationToken);
        return Results.Ok(new { status = "ok" });
    }
    catch (Exception exception) when (exception is not OperationCanceledException)
    {
        app.Logger.LogWarning(exception, "База данных недоступна.");
        return Results.Json(new { status = "unavailable" }, statusCode: 503);
    }
});

app.MapGet("/api/courses", async (LearningDbContext db, HttpContext context, CancellationToken cancellationToken) =>
{
    var courses = await AccessRules.VisibleCourses(db, context.User).AsNoTracking().OrderBy(course => EF.Property<int>(course, "Position"))
        .Select(course => new CourseSummary(course.Id, course.Code, course.Title, course.Description,
            course.Cover, course.Category, course.TutorId, course.Enrolled, course.Progress, course.Status, course.CoverColor,
            course.Faculty, course.AcademicYear))
        .ToListAsync(cancellationToken);
    return Results.Ok(courses);
}).RequireAuthorization().Produces<CourseSummary[]>();

app.MapGet("/api/courses/{id}", async (string id, LearningDbContext db, HttpContext context, CancellationToken cancellationToken) =>
{
    var course = await AccessRules.VisibleCourses(db, context.User).AsNoTracking().AsSplitQuery()
        .Include(course => course.Sections.OrderBy(section => section.Order))
        .ThenInclude(section => section.Activities.OrderBy(activity => EF.Property<int>(activity, "Position")))
        .SingleOrDefaultAsync(course => course.Id == id, cancellationToken);
    return course is null
        ? Results.NotFound(new { error = "not found" })
        : Results.Ok(CourseDetail.FromDetail(course));
}).RequireAuthorization().Produces<CourseDetail>();

app.Run();
