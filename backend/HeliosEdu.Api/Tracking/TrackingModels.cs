using System.Text.Json;

namespace HeliosEdu.Api.Tracking;

/// <summary>
/// Прогресс ученика по материалу курса (видео, PDF, презентация, тест) — один на пару курс + материал.
/// Покрытие, время и страницы не уменьшаются (объединение сессий), «завершено» не снимается.
/// </summary>
public sealed class ActivityProgress
{
    public string UserId { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string ActivityId { get; set; } = "";
    public string ActivityType { get; set; } = "";
    public int Coverage { get; set; }
    public int ActiveTimeSec { get; set; }
    public bool Completed { get; set; }
    public int Seeks { get; set; }
    public int Pauses { get; set; }
    public double MaxRate { get; set; } = 1;
    public int? PagesViewed { get; set; }
    public int? TotalPages { get; set; }
    public double? DurationSec { get; set; }
    /// <summary>видео: где остановился, сек — с этого места продолжается просмотр</summary>
    public int? Position { get; set; }
    public int Sessions { get; set; } = 1;
    public string LastSessionId { get; set; } = "";
    public DateTimeOffset FirstAt { get; set; }
    public DateTimeOffset LastAt { get; set; }
}

/// <summary>Событие просмотра (xAPI-подобное: кто, глагол, что). «Пульс» не хранится — он только обновляет прогресс.</summary>
public sealed class TrackingEvent
{
    public long Id { get; set; }
    public DateTimeOffset At { get; set; }
    public string UserId { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string ActivityId { get; set; } = "";
    public string ActivityType { get; set; } = "";
    public string SessionId { get; set; } = "";
    public string Verb { get; set; } = "";
    public double? Position { get; set; }
    public JsonElement? Payload { get; set; }
}

/// <summary>Пара в недельном расписании группы.</summary>
public sealed class ScheduleSlot
{
    public string Id { get; set; } = "";
    public string TenantId { get; set; } = "";
    /// <summary>название группы (как Account.Group)</summary>
    public string Group { get; set; } = "";
    public string CourseId { get; set; } = "";
    /// <summary>1 — понедельник … 6 — суббота</summary>
    public int Weekday { get; set; }
    public int Pair { get; set; }
    /// <summary>lecture, practice, seminar</summary>
    public string Kind { get; set; } = "";
    public string Room { get; set; } = "";
}

// Ответы — в формате src/shared/lib/tracking/types.ts и src/shared/types/domain.ts. Время — миллисекунды Unix,
// как в трекере браузера (Date.now()).

public sealed record ProgressInfo(string SessionId, string UserId, string ActivityId, string ActivityType, int Coverage,
    int ActiveTimeSec, bool Completed, int? Seeks, int? Pauses, double? MaxRate, int? PagesViewed, int? TotalPages,
    double? DurationSec, int? Position, long Ts, string UserName, string? Group, long FirstAt, long LastAt, int Sessions);

public sealed record TrackingEventInfo(string Id, string SessionId, string UserId, string ActivityId, string ActivityType,
    string Verb, double? Position, JsonElement? Payload, long Ts);

public sealed record LessonStatRow(string UserId, string UserName, string? Group, int Coverage, int ActiveTimeSec,
    bool Completed, int? Seeks, int? PagesViewed, int? TotalPages, long? LastAt, string Status);

public sealed record LessonStats(IReadOnlyList<LessonStatRow> Rows, IReadOnlyList<TrackingEventInfo>? Events);

public sealed record CourseActivityStat(string ActivityId, string Title, string Type, int Started, int Completed, int Total,
    int AvgCoverage, int AvgTimeSec);

public sealed record CourseActivityStats(IReadOnlyList<CourseActivityStat> Activities);

public sealed record LeaderboardEntry(int Rank, string UserId, string UserName, string Group, int Score,
    int MaterialsCompleted, int MaterialsTotal, int AvgCoverage, int? QuizAvg, int Streak, bool? IsCurrentUser);

public sealed record Leaderboard(string CourseId, IReadOnlyList<LeaderboardEntry> Entries);

public sealed record PairTimeInfo(int N, string Start, string End);

public sealed record ScheduleCourse(string Id, string Code, string Title, string? CoverColor);

public sealed record ScheduleSlotInfo(string Id, string CourseId, int Weekday, int Pair, string Kind, string Room,
    ScheduleCourse? Course);

public sealed record ScheduleInfo(string Group, IReadOnlyList<PairTimeInfo> Pairs, IReadOnlyList<ScheduleSlotInfo> Slots);

public sealed record TrackingAccepted(bool Ok, int Accepted);
