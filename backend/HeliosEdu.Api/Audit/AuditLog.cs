using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;

namespace HeliosEdu.Api.Audit;

/// <summary>
/// Запись в журнал действий. Вызывается до SaveChanges изменения — запись уходит в той же транзакции.
/// Тексты действий — здесь и в src/shared/lib/audit-labels.ts (подписи фильтра).
/// </summary>
public static class AuditLog
{
    public static readonly IReadOnlyDictionary<string, (string Text, string Category)> Actions =
        new Dictionary<string, (string, string)>
        {
            ["auth.login"] = ("Вход", "auth"),
            ["auth.login_failed"] = ("Неудачный вход", "auth"),
            ["auth.logout"] = ("Выход", "auth"),
            ["auth.registered"] = ("Регистрация", "auth"),
            ["user.created"] = ("Добавлен пользователь", "users"),
            ["user.updated"] = ("Изменён пользователь", "users"),
            ["user.blocked"] = ("Заблокирован пользователь", "users"),
            ["user.unblocked"] = ("Разблокирован пользователь", "users"),
            ["cohort.created"] = ("Создана группа", "cohorts"),
            ["cohort.updated"] = ("Изменена группа", "cohorts"),
            ["cohort.members"] = ("Изменён состав группы", "cohorts"),
            ["cohort.deleted"] = ("Удалена группа", "cohorts"),
            ["course.created"] = ("Создан курс", "courses"),
            ["course.updated"] = ("Изменён курс", "courses"),
            ["course.cover"] = ("Изменена обложка", "courses"),
            ["announcement.created"] = ("Объявление", "courses"),
            ["section.created"] = ("Добавлен модуль", "content"),
            ["section.renamed"] = ("Переименован модуль", "content"),
            ["section.deleted"] = ("Удалён модуль", "content"),
            ["section.reordered"] = ("Изменён порядок модулей", "content"),
            ["activity.created"] = ("Добавлен материал", "content"),
            ["activity.updated"] = ("Изменён материал", "content"),
            ["activity.deleted"] = ("Удалён материал", "content"),
            ["activity.reordered"] = ("Изменён порядок материалов", "content"),
            ["quiz.questions"] = ("Изменены вопросы теста", "content"),
            ["skill.created"] = ("Добавлен навык", "adaptive"),
            ["skill.updated"] = ("Изменён навык", "adaptive"),
            ["skill.deleted"] = ("Удалён навык", "adaptive"),
            ["skill.imported"] = ("Импорт навыков", "adaptive"),
            ["activity.skills"] = ("Изменены навыки материала", "adaptive"),
            ["adaptive.toggled"] = ("Адаптация курса", "adaptive"),
            ["adaptive.override"] = ("Ручное решение по навыку", "adaptive"),
            ["adaptive.pin"] = ("Закреплено задание ученику", "adaptive"),
            ["submission.reviewed"] = ("Проверена работа", "grades"),
            ["grade.updated"] = ("Изменена оценка", "grades"),
            ["file.uploaded"] = ("Загружен файл", "files"),
            ["file.cleanup"] = ("Очистка хранилища", "files"),
            ["settings.updated"] = ("Изменены настройки", "settings"),
        };

    public static string Text(string action) => Actions.TryGetValue(action, out var item) ? item.Text : action;

    /// <summary>Записать действие пользователя из сессии запроса.</summary>
    public static void Write(LearningDbContext db, HttpContext context, string action, string targetType,
        string? targetId, string targetName, IEnumerable<AuditChange>? changes = null) =>
        Write(db, context.Items[typeof(Account)] as Account, action, targetType, targetId, targetName, changes);

    public static void Write(LearningDbContext db, Account? actor, string action, string targetType, string? targetId,
        string targetName, IEnumerable<AuditChange>? changes = null, string? actorName = null)
    {
        if (!Actions.TryGetValue(action, out var meta))
            throw new ArgumentException($"Неизвестное действие журнала: {action}", nameof(action));
        var list = changes?.ToList();
        db.AuditLog.Add(new AuditEntry
        {
            At = DateTimeOffset.UtcNow, TenantId = actor?.TenantId ?? "pspu", ActorId = actor?.Id,
            ActorName = actorName ?? actor?.Name ?? "—", ActorRole = actor?.Role ?? "",
            Action = action, Category = meta.Category, TargetType = targetType, TargetId = targetId,
            TargetName = targetName.Length > 300 ? targetName[..300] : targetName,
            Changes = list is { Count: > 0 } ? list : null,
        });
    }

    /// <summary>Изменённые поля: подпись, было, стало — только те, что действительно поменялись.</summary>
    public static List<AuditChange> Diff(params (string Field, string? Before, string? After)[] fields) =>
        fields.Where(item => (item.Before ?? "") != (item.After ?? ""))
            .Select(item => new AuditChange(item.Field, Shorten(item.Before), Shorten(item.After))).ToList();

    private static string? Shorten(string? value) =>
        string.IsNullOrEmpty(value) ? null : value.Length > 200 ? value[..200] + "…" : value;

    public static string Role(string? role) => role switch
    {
        "student" => "студент", "tutor" => "преподаватель", "organizer" => "организатор", "admin" => "администратор",
        _ => role ?? "",
    };

    public static string Status(string? status) => status switch
    {
        "draft" => "черновик", "published" => "опубликован", "archived" => "в архиве",
        "active" => "активен", "blocked" => "заблокирован", _ => status ?? "",
    };

    public static string YesNo(bool value) => value ? "да" : "нет";
}
