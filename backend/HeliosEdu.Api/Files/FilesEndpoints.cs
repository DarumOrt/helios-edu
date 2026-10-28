using HeliosEdu.Api.Audit;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Files;

// Файлы курсов (docs/backend/p6-files.md): загрузка напрямую в хранилище по временной ссылке, чтение через
// /api/files/{id} с проверкой прав. Файлы курса загружает тот, кто правит курс; файл к заданию — студент курса.
public static class FilesEndpoints
{
    public const string UrlPrefix = "/api/files/";
    private static readonly TimeSpan UploadLifetime = TimeSpan.FromHours(1);
    private static readonly TimeSpan DownloadLifetime = TimeSpan.FromHours(1);

    private static Account Actor(HttpContext context) => (Account)context.Items[typeof(Account)]!;
    private static IResult Unavailable() => Fail(503, "Хранилище файлов не подключено");

    public static void MapFilesEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/files").RequireAuthorization().AddEndpointFilter<ManagementWriteFilter>();
        group.MapPost("", CreateAsync).Produces<UploadTicket>(201);
        group.MapPost("/{id}/complete", CompleteAsync).Produces<StoredFileInfo>();
        group.MapGet("/{id}", OpenAsync);
        group.MapPost("/cleanup", CleanupAsync).RequireAuthorization(AccessRules.ManageSystem).Produces<CleanupResult>();
    }

    /// <summary>POST { kind, courseId, fileName, size } — проверить права и файл, выдать ссылку на загрузку.</summary>
    private static async Task<IResult> CreateAsync(HttpContext context, LearningDbContext db, FileStorage storage)
    {
        if (!storage.IsConfigured) return Unavailable();
        var actor = Actor(context);
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        if (!FileKinds.All.TryGetValue(input.Text("kind"), out var kind))
            return Invalid(new() { ["kind"] = "Неизвестный вид файла" });

        var course = await AccessRules.VisibleCourses(db, context.User).AsNoTracking()
            .SingleOrDefaultAsync(course => course.Id == input.Text("courseId"), context.RequestAborted);
        if (course is null) return Fail(404, "not found");
        if (kind == FileKinds.Submission ? actor.Role != "student" : !AccessRules.CanEditCourse(actor, course))
            return Fail(403, kind == FileKinds.Submission
                ? "Файл к заданию загружает студент курса"
                : "Загружать файлы курса может его преподаватель или организатор");

        var fileName = Path.GetFileName(input.Text("fileName").Replace('\\', '/'));
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var size = input.Number("size");
        var fields = new Dictionary<string, string>();
        if (fileName.Length is 0 or > 200) fields["fileName"] = "Имя файла — от 1 до 200 символов";
        else if (!kind.Types.TryGetValue(extension, out _)) fields["fileName"] = $"Этот формат не подходит. Можно: {kind.Formats}";
        if (size is not { } bytes || bytes <= 0 || bytes != Math.Floor(bytes)) fields["size"] = "Файл пустой";
        else if (bytes > kind.MaxBytes) fields["size"] = $"Файл больше {kind.LimitText}";
        if (fields.Count > 0) return Invalid(fields);

        var now = DateTimeOffset.UtcNow;
        var file = new StoredFile
        {
            Id = $"f-{Guid.NewGuid().ToString("N")[..12]}", CourseId = course.Id, Kind = kind.Name, FileName = fileName,
            ContentType = kind.Types[extension], Size = (long)size!.Value, OwnerId = actor.Id, CreatedAt = now,
        };
        // ключ без имени файла: имя хранится в записи, в ключе нет кириллицы и пробелов
        file.ObjectKey = $"{course.Id}/{kind.Name}/{file.Id}";
        db.Files.Add(file);
        await db.SaveChangesAsync(context.RequestAborted);
        var expires = now.Add(UploadLifetime);
        var url = await storage.UploadUrlAsync(file.ObjectKey, file.ContentType, expires.UtcDateTime);
        return Results.Json(new UploadTicket(file.Id, url, file.ContentType, expires), statusCode: 201);
    }

    /// <summary>Браузер закончил загрузку: убедиться, что файл в хранилище и размер совпал.</summary>
    private static async Task<IResult> CompleteAsync(string id, HttpContext context, LearningDbContext db, FileStorage storage)
    {
        if (!storage.IsConfigured) return Unavailable();
        var file = await db.Files.SingleOrDefaultAsync(item => item.Id == id && item.OwnerId == Actor(context).Id,
            context.RequestAborted);
        if (file is null) return Fail(404, "not found");
        if (file.Status != "pending") return Results.Ok(StoredFileInfo.From(file));
        var size = await storage.SizeAsync(file.ObjectKey, context.RequestAborted);
        if (size is null) return Fail(409, "Файл не загружен — попробуйте ещё раз");
        if (size != file.Size)
        {
            // загружено не то, что заявлено (и проверено по лимиту) — такой файл не принимаем
            await storage.DeleteAsync(file.ObjectKey, context.RequestAborted);
            db.Files.Remove(file);
            await db.SaveChangesAsync(context.RequestAborted);
            return Fail(400, "Размер файла не совпал — загрузите его ещё раз", new() { ["size"] = "Размер файла не совпал" });
        }
        file.Status = "ready";
        file.ReadyAt = DateTimeOffset.UtcNow;
        // файлы курса — в журнал; файлы работ — часть учёбы (видны в работе студента)
        if (file.Kind != FileKinds.Submission.Name)
        {
            var code = await db.Courses.Where(course => course.Id == file.CourseId).Select(course => course.Code)
                .SingleAsync(context.RequestAborted);
            AuditLog.Write(db, context, "file.uploaded", "file", file.Id, $"{code} · {file.FileName}",
                AuditLog.Diff(("Вид", null, file.Kind), ("Размер", null, $"{file.Size / 1024d / 1024d:0.##} МБ")));
        }
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(StoredFileInfo.From(file));
    }

    /// <summary>Открыть файл: проверить доступ и перенаправить на временную ссылку хранилища.</summary>
    private static async Task<IResult> OpenAsync(string id, HttpContext context, LearningDbContext db, FileStorage storage)
    {
        if (!storage.IsConfigured) return Unavailable();
        var file = await db.Files.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id && item.Status == "ready",
            context.RequestAborted);
        if (file is null || !await CanReadAsync(db, context, file)) return Fail(404, "not found");
        var url = await storage.DownloadUrlAsync(file.ObjectKey, file.FileName, file.ContentType,
            DateTime.UtcNow.Add(DownloadLifetime));
        return Results.Redirect(url);
    }

    /// <summary>
    /// Обложку видят все вошедшие (она есть в каталоге); файлы курса — те, кому виден курс;
    /// файл работы — её автор и проверяющие курса (администратор, преподаватель своего курса).
    /// </summary>
    private static async Task<bool> CanReadAsync(LearningDbContext db, HttpContext context, StoredFile file)
    {
        if (file.Kind == FileKinds.Cover.Name) return true;
        var visible = await AccessRules.VisibleCourses(db, context.User)
            .AnyAsync(course => course.Id == file.CourseId, context.RequestAborted);
        if (file.Kind != FileKinds.Submission.Name) return visible;
        var actor = Actor(context);
        return file.OwnerId == actor.Id || actor.Role is "admin" or "tutor" && visible;
    }

    private static async Task<IResult> CleanupAsync(HttpContext context, LearningDbContext db, FileStorage storage)
    {
        if (!storage.IsConfigured) return Unavailable();
        var result = await FileJanitor.RunOnceAsync(db, storage, DateTimeOffset.UtcNow, context.RequestAborted);
        AuditLog.Write(db, context, "file.cleanup", "storage", null, "Хранилище файлов",
            AuditLog.Diff(("Брошенные загрузки", null, result.Abandoned.ToString()), ("В корзину", null, result.Trashed.ToString()),
                ("Удалено", null, result.Deleted.ToString()), ("Без записи", null, result.Orphans.ToString())));
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(result);
    }

    /// <summary>
    /// Проверка ссылки на загруженный файл (материал, обложка, работа): свой курс, нужный вид, загружен.
    /// Не ссылка на /api/files/ — null (внешние ссылки и /media/… проверяет ContentInput).
    /// </summary>
    public static async Task<string?> CheckAttachedAsync(LearningDbContext db, string? url, string courseId, string kind,
        string? ownerId, CancellationToken token)
    {
        if (url is null || !url.StartsWith(UrlPrefix, StringComparison.Ordinal)) return null;
        var id = url[UrlPrefix.Length..];
        var ok = await db.Files.AnyAsync(file => file.Id == id && file.CourseId == courseId && file.Kind == kind &&
            file.Status != "pending" && (ownerId == null || file.OwnerId == ownerId), token);
        return ok ? null : "Файл не найден — загрузите его ещё раз";
    }
}
