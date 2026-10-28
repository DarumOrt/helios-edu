namespace HeliosEdu.Api.Files;

/// <summary>
/// Запись о файле в хранилище (сам файл — в S3 под ключом ObjectKey). Статусы:
/// pending — выдана ссылка на загрузку; ready — загружен и проверен; trash — ни на что не ссылается,
/// через 7 дней его удалит FileJanitor (как корзина файлов Moodle).
/// </summary>
public sealed class StoredFile
{
    public string Id { get; set; } = "";
    public string CourseId { get; set; } = "";
    /// <summary>video, document, cover, submission — см. FileKinds</summary>
    public string Kind { get; set; } = "";
    public string ObjectKey { get; set; } = "";
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long Size { get; set; }
    public string Status { get; set; } = "pending";
    public string OwnerId { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ReadyAt { get; set; }
    public DateTimeOffset? TrashedAt { get; set; }

    public string Url => $"/api/files/{Id}";
}

/// <summary>Вид файла: форматы (расширение → тип) и предельный размер.</summary>
public sealed record FileKind(string Name, long MaxBytes, string LimitText, IReadOnlyDictionary<string, string> Types)
{
    public string Formats => string.Join(", ", Types.Keys.Select(ext => ext.TrimStart('.')));
}

/// <summary>Правила загрузки — те же лимиты и тексты, что в src/shared/lib/file-rules.ts.</summary>
public static class FileKinds
{
    private const long Mb = 1024 * 1024;

    public static readonly FileKind Video = new("video", 1024 * Mb, "1 ГБ", new Dictionary<string, string>
    {
        [".mp4"] = "video/mp4", [".webm"] = "video/webm",
    });
    public static readonly FileKind Document = new("document", 50 * Mb, "50 МБ", new Dictionary<string, string>
    {
        [".pdf"] = "application/pdf",
    });
    public static readonly FileKind Cover = new("cover", 5 * Mb, "5 МБ", new Dictionary<string, string>
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png", [".webp"] = "image/webp",
    });
    public static readonly FileKind Submission = new("submission", 50 * Mb, "50 МБ", new Dictionary<string, string>
    {
        [".pdf"] = "application/pdf",
        [".doc"] = "application/msword",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".odt"] = "application/vnd.oasis.opendocument.text",
        [".pptx"] = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".txt"] = "text/plain",
        [".zip"] = "application/zip",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
    });

    public static readonly IReadOnlyDictionary<string, FileKind> All =
        new[] { Video, Document, Cover, Submission }.ToDictionary(kind => kind.Name);

    /// <summary>Какой вид файла подходит материалу курса (src у видео, PDF и презентации).</summary>
    public static string? ForActivity(string activityType) => activityType switch
    {
        "video" => Video.Name,
        "pdf" or "presentation" => Document.Name,
        _ => null,
    };
}

/// <summary>Выдача ссылки на загрузку: POST /api/files → 201.</summary>
public sealed record UploadTicket(string Id, string UploadUrl, string ContentType, DateTimeOffset ExpiresAt);

/// <summary>Загруженный файл: POST /api/files/{id}/complete → 200.</summary>
public sealed record StoredFileInfo(string Id, string Kind, string CourseId, string FileName, string ContentType, long Size, string Url)
{
    public static StoredFileInfo From(StoredFile file) =>
        new(file.Id, file.Kind, file.CourseId, file.FileName, file.ContentType, file.Size, file.Url);
}

/// <summary>Итог ручной очистки: POST /api/files/cleanup (администратор).</summary>
public sealed record CleanupResult(int Abandoned, int Trashed, int Restored, int Deleted, int Orphans);
