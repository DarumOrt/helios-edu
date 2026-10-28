using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace HeliosEdu.Api.Courses;

// Идентификаторы разделов и материалов уникальны только внутри курса.
public sealed class Course
{
    public bool AdaptiveEnabled { get; set; } = true;
    public required string Id { get; set; }
    public required string Code { get; set; }
    public required string Title { get; set; }
    public required string Description { get; set; }
    public string? Cover { get; set; }
    public string? CoverColor { get; set; }
    public string Status { get; set; } = "draft";
    public required string Category { get; set; }
    public required string TutorId { get; set; }
    // Короткое название факультета («ИНЭК») и учебный год («2026/2027») — для поиска курсов.
    public string? Faculty { get; set; }
    public string? AcademicYear { get; set; }
    // В корзине курсов (CourseTrash): не виден в списках и ученикам, оценки по нему пока остаются в «Моих оценках».
    public DateTimeOffset? DeletedAt { get; set; }
    public string? DeletedByName { get; set; }
    // Участники и прогресс не хранятся: их считает CourseProgress для того, кто смотрит.
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
    // Пройден ли материал — своё у каждого ученика (CourseProgress), в базе не хранится.
    [NotMapped] public bool? Completed { get; set; }
    [JsonConverter(typeof(UtcIsoDateConverter))] public DateTimeOffset? Due { get; set; }
    public string? Description { get; set; }
    public int? MaxGrade { get; set; }
    // тест: сколько попыток можно завершить (null — без ограничения)
    public int? MaxAttempts { get; set; }
    public string? Src { get; set; }
    public int? Pages { get; set; }
}
