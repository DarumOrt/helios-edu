namespace HeliosEdu.Api.Notifications;

// Объявление курса. Получатели не хранятся: объявление видят все, кому виден курс (как в моках Next).
public sealed class Announcement
{
    public string Id { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string AuthorId { get; set; } = "";
    public string AuthorName { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}

// Личное уведомление (например, «оценка выставлена»). Объявления и сроки в эту таблицу не пишутся —
// они собираются при чтении.
public sealed class Notification
{
    public string Id { get; set; } = "";
    public string UserId { get; set; } = "";
    public string Type { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string? Link { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

// Прочитанность — по пользователю и id уведомления (объявления, личные, сроки).
public sealed class NotificationRead
{
    public string UserId { get; set; } = "";
    public string NotificationId { get; set; } = "";
    public DateTimeOffset ReadAt { get; set; }
}

// Ответы — как Announcement и Notification в src/shared/types/domain.ts.
public sealed record AnnouncementInfo(string Id, string CourseId, string Title, string Body, string AuthorName,
    DateTimeOffset CreatedAt);
public sealed record NotificationInfo(string Id, string Type, string Title, string Body, DateTimeOffset CreatedAt,
    bool Read, string? Link);
