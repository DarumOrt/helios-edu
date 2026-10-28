using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Files;

/// <summary>
/// Фоновая задача хранилища. При старте создаёт хранилище (повторяя, пока оно не поднимется),
/// затем раз в Storage:CleanupMinutes убирает лишнее — по образцу корзины файлов Moodle:
/// <list type="bullet">
/// <item>брошенная загрузка (pending старше суток) — удаляется;</item>
/// <item>загруженный файл, на который сутки ничто не ссылается (заменили видео, удалили материал,
/// пересдали работу до проверки), — в корзину; снова сослались — возвращается;</item>
/// <item>корзина старше 7 дней — удаляется из хранилища и из базы;</item>
/// <item>объект в хранилище без записи в базе («осиротевший», старше суток) — удаляется.</item>
/// </list>
/// Сданная работа ссылается на свой файл всегда, поэтому файлы работ не удаляются вместе с материалом.
/// </summary>
public sealed class FileJanitor(IServiceScopeFactory scopes, FileStorage storage, ILogger<FileJanitor> logger) : BackgroundService
{
    public static readonly TimeSpan Grace = TimeSpan.FromDays(1);
    public static readonly TimeSpan TrashLifetime = TimeSpan.FromDays(7);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!storage.IsConfigured)
        {
            logger.LogInformation("Хранилище файлов не подключено (Storage:ServiceUrl пуст) — загрузка файлов выключена.");
            return;
        }
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await storage.EnsureBucketAsync(stoppingToken);
                break;
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning("Хранилище файлов пока недоступно: {Message}", exception.Message);
                await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
            }
        }
        var interval = TimeSpan.FromMinutes(Math.Max(1, storage.Options.CleanupMinutes));
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(interval, stoppingToken);
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<LearningDbContext>();
                var result = await RunOnceAsync(db, storage, DateTimeOffset.UtcNow, stoppingToken);
                if (result != new CleanupResult(0, 0, 0, 0, 0)) logger.LogInformation("Очистка файлов: {Result}", result);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Очистка файлов не удалась — повторим позже.");
            }
        }
    }

    /// <summary>Один проход очистки (его же запускает администратор: POST /api/files/cleanup).</summary>
    public static async Task<CleanupResult> RunOnceAsync(LearningDbContext db, FileStorage storage, DateTimeOffset now,
        CancellationToken token)
    {
        var files = await db.Files.ToListAsync(token);
        var used = await ReferencedAsync(db, token);
        int abandoned = 0, trashed = 0, restored = 0, deleted = 0, orphans = 0;
        foreach (var file in files)
        {
            if (file.Status == "pending" && now - file.CreatedAt > Grace)
            {
                await storage.DeleteAsync(file.ObjectKey, token);
                db.Files.Remove(file);
                abandoned++;
            }
            else if (file.Status == "ready" && !used.Contains(file.Id) && now - (file.ReadyAt ?? file.CreatedAt) > Grace)
            {
                file.Status = "trash";
                file.TrashedAt = now;
                trashed++;
            }
            else if (file.Status == "trash" && used.Contains(file.Id))
            {
                file.Status = "ready";
                file.TrashedAt = null;
                restored++;
            }
            else if (file.Status == "trash" && now - (file.TrashedAt ?? now) > TrashLifetime)
            {
                await storage.DeleteAsync(file.ObjectKey, token);
                db.Files.Remove(file);
                deleted++;
            }
        }
        await db.SaveChangesAsync(token);

        var keys = files.Select(file => file.ObjectKey).ToHashSet();
        foreach (var (key, modified) in await storage.ListAsync(token))
            if (!keys.Contains(key) && now - modified > Grace)
            {
                await storage.DeleteAsync(key, token);
                orphans++;
            }
        return new CleanupResult(abandoned, trashed, restored, deleted, orphans);
    }

    /// <summary>Файлы, на которые ссылаются материалы, обложки и сданные работы.</summary>
    private static async Task<HashSet<string>> ReferencedAsync(LearningDbContext db, CancellationToken token)
    {
        var courses = await db.Courses.AsNoTracking().AsSplitQuery()
            .Include(course => course.Sections).ThenInclude(section => section.Activities).ToListAsync(token);
        var urls = courses.Select(course => course.Cover)
            .Concat(courses.SelectMany(course => course.Sections).SelectMany(section => section.Activities).Select(activity => activity.Src));
        var ids = urls.Where(url => url?.StartsWith(FilesEndpoints.UrlPrefix, StringComparison.Ordinal) == true)
            .Select(url => url![FilesEndpoints.UrlPrefix.Length..]).ToHashSet();
        ids.UnionWith(await db.Submissions.Where(item => item.FileId != null).Select(item => item.FileId!).ToListAsync(token));
        return ids;
    }
}
