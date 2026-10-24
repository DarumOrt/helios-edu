namespace HeliosEdu.Api.Courses;

// Формат совместим с shared/types/domain.ts; поля EF не попадают в ответы.
public record CourseSummary(
    string Id, string Code, string Title, string Description, string? Cover,
    string Category, string TutorId, int Enrolled, int? Progress, string Status, string? CoverColor)
{
    public static CourseSummary From(Course course) => new(course.Id, course.Code, course.Title,
        course.Description, course.Cover, course.Category, course.TutorId, course.Enrolled,
        course.Progress, course.Status, course.CoverColor);
}

public sealed record CourseDetail(
    string Id, string Code, string Title, string Description, string? Cover,
    string Category, string TutorId, int Enrolled, int? Progress,
    IReadOnlyList<Section> Sections, string Status, string? CoverColor)
    : CourseSummary(Id, Code, Title, Description, Cover, Category, TutorId, Enrolled, Progress, Status, CoverColor)
{
    public static CourseDetail FromDetail(Course course) => new(
        course.Id, course.Code, course.Title, course.Description, course.Cover,
        course.Category, course.TutorId, course.Enrolled, course.Progress,
        course.Sections.OrderBy(section => section.Order).ToList(), course.Status, course.CoverColor);
}
