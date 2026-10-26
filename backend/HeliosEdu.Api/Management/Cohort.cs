namespace HeliosEdu.Api.Management;

public sealed class Cohort
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string NormalizedName { get; set; } = "";
    public string? Faculty { get; set; }
    // Курс обучения (1–5 бакалавриат, 1–2 магистратура), уровень и направление — как в расписании вуза.
    public int? Year { get; set; }
    public string? Level { get; set; }
    public string? DirectionCode { get; set; }
    public string? Direction { get; set; }
    public string? Profile { get; set; }
    public string TenantId { get; set; } = "pspu";
}

public sealed class CohortCourse
{
    public string CohortId { get; set; } = "";
    public string CourseId { get; set; } = "";
    // Сохраняем порядок полного списка courseIds, как в моках.
    public int Position { get; set; }
}

public sealed record CohortInfo(string Id, string Name, string? Faculty,
    IReadOnlyList<string> MemberIds, IReadOnlyList<string> CourseIds,
    int? Year, string? Level, string? DirectionCode, string? Direction, string? Profile);
