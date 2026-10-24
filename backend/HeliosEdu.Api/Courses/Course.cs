namespace HeliosEdu.Api.Courses;

// Идентификаторы разделов и материалов уникальны только внутри курса.
public sealed class Course
{
    public required string Id { get; set; }
    public required string Code { get; set; }
    public required string Title { get; set; }
    public required string Description { get; set; }
    public string? Cover { get; set; }
    public string? CoverColor { get; set; }
    public string Status { get; set; } = "draft";
    public required string Category { get; set; }
    public required string TutorId { get; set; }
    public int Enrolled { get; set; }
    // Пока это демонстрационный прогресс, общий для всех посетителей.
    public int? Progress { get; set; }
    public List<Section> Sections { get; set; } = [];
}

public sealed class Section
{
    public required string Id { get; set; }
    public required string Title { get; set; }
    public int Order { get; set; }
    public List<Activity> Activities { get; set; } = [];
}

public sealed class Activity
{
    public required string Id { get; set; }
    public required string Type { get; set; }
    public required string Title { get; set; }
    public int? DurationMin { get; set; }
    public bool? Completed { get; set; }
    public string? Due { get; set; }
    public string? Src { get; set; }
    public int? Pages { get; set; }
}
