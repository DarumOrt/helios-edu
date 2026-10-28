namespace HeliosEdu.Api.Audit;

/// <summary>Настройки системы — одна строка на организацию (TenantId).</summary>
public sealed class SystemSettings
{
    public string TenantId { get; set; } = "";
    /// <summary>студенты могут сами создать учётную запись на /register</summary>
    public bool AllowRegistration { get; set; } = true;
    /// <summary>преподаватели могут отправлять объявления курсу</summary>
    public bool AnnouncementsEnabled { get; set; } = true;
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>
/// Запись журнала действий: только добавление (триггер в базе и проверка в LearningDbContext).
/// Пишется в той же транзакции, что и изменение: не сохранилось изменение — нет и записи.
/// </summary>
public sealed class AuditEntry
{
    public long Id { get; set; }
    public DateTimeOffset At { get; set; }
    public string TenantId { get; set; } = "";
    /// <summary>кто сделал; null — неудачный вход (известна только введённая почта)</summary>
    public string? ActorId { get; set; }
    public string ActorName { get; set; } = "";
    public string ActorRole { get; set; } = "";
    /// <summary>код действия: user.updated, auth.login … (AuditLog.Actions)</summary>
    public string Action { get; set; } = "";
    /// <summary>раздел для фильтра: auth, users, cohorts, courses, content, adaptive, grades, files, settings</summary>
    public string Category { get; set; } = "";
    public string TargetType { get; set; } = "";
    public string? TargetId { get; set; }
    /// <summary>название объекта на момент действия — журнал читается без id</summary>
    public string TargetName { get; set; } = "";
    /// <summary>что изменилось (jsonb): [{ field, before, after }]</summary>
    public List<AuditChange>? Changes { get; set; }
}

/// <summary>Изменённое поле: подпись по-русски, было и стало (уже в читаемом виде).</summary>
public sealed record AuditChange(string Field, string? Before, string? After);

/// <summary>Запись для GET /api/audit.</summary>
public sealed record AuditEntryInfo(long Id, DateTimeOffset At, string ActorName, string ActorRole, string Action,
    string ActionText, string Category, string TargetType, string? TargetId, string Target,
    IReadOnlyList<AuditChange>? Changes);

/// <summary>Страница журнала: записи новее → старее; nextCursor — id для следующей страницы (нет — конец).</summary>
public sealed record AuditPage(IReadOnlyList<AuditEntryInfo> Items, long? NextCursor);

/// <summary>GET/PUT /api/settings.</summary>
public sealed record SettingsInfo(bool AllowRegistration, bool AnnouncementsEnabled)
{
    public static SettingsInfo From(SystemSettings settings) =>
        new(settings.AllowRegistration, settings.AnnouncementsEnabled);
}
