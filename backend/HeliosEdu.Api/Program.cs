using System.Text.Json.Serialization;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("Database")
    ?? throw new InvalidOperationException("Задайте ConnectionStrings__Database для PostgreSQL.");

builder.Services.AddDbContext<LearningDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull);
builder.Services.AddProblemDetails();
var app = builder.Build();
app.UseExceptionHandler();

// Миграции и моки включаются явно: production не должен заполняться демоданными.
if (app.Configuration.GetValue<bool>("Database:ApplyMigrations"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<LearningDbContext>();
    await db.Database.MigrateAsync();
    if (app.Configuration.GetValue<bool>("Database:SeedDemoData"))
        await DemoData.SeedAsync(db, CancellationToken.None);
}

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/health/ready", async (LearningDbContext db, CancellationToken cancellationToken) =>
{
    try
    {
        // Проверяем и подключение, и наличие схемы после миграции.
        await db.Courses.AnyAsync(cancellationToken);
        return Results.Ok(new { status = "ok" });
    }
    catch (Exception exception) when (exception is not OperationCanceledException)
    {
        app.Logger.LogWarning(exception, "База данных недоступна.");
        return Results.Json(new { status = "unavailable" }, statusCode: 503);
    }
});

// Первый этап — публичный демонстрационный каталог. Авторизация появится отдельно.
app.MapGet("/api/courses", async (LearningDbContext db, CancellationToken cancellationToken) =>
{
    var courses = await db.Courses.AsNoTracking().OrderBy(course => EF.Property<int>(course, "Position"))
        .Select(course => new CourseSummary(course.Id, course.Code, course.Title, course.Description,
            course.Cover, course.Category, course.TutorId, course.Enrolled, course.Progress))
        .ToListAsync(cancellationToken);
    return Results.Ok(courses);
});

app.MapGet("/api/courses/{id}", async (string id, LearningDbContext db, CancellationToken cancellationToken) =>
{
    var course = await db.Courses.AsNoTracking().AsSplitQuery()
        .Include(course => course.Sections.OrderBy(section => section.Order))
        .ThenInclude(section => section.Activities.OrderBy(activity => EF.Property<int>(activity, "Position")))
        .SingleOrDefaultAsync(course => course.Id == id, cancellationToken);
    return course is null
        ? Results.NotFound(new { error = "not found" })
        : Results.Ok(CourseDetail.FromDetail(course));
});

app.Run();
