namespace HeliosEdu.Api.Management;

public sealed class Cohort
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string NormalizedName { get; set; } = "";
    public string? Faculty { get; set; }
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
    IReadOnlyList<string> MemberIds, IReadOnlyList<string> CourseIds);
