namespace HeliosEdu.Api.Courses;

// Формат совместим с shared/types/domain.ts; поля EF не попадают в ответы.
public record CourseSummary(
    string Id, string Code, string Title, string Description, string? Cover,
    string Category, string TutorId, int Enrolled, int? Progress);

public sealed record CourseDetail(
    string Id, string Code, string Title, string Description, string? Cover,
    string Category, string TutorId, int Enrolled, int? Progress,
    IReadOnlyList<Section> Sections)
    : CourseSummary(Id, Code, Title, Description, Cover, Category, TutorId, Enrolled, Progress)
{
    public static CourseDetail FromDetail(Course course) => new(
        course.Id, course.Code, course.Title, course.Description, course.Cover,
        course.Category, course.TutorId, course.Enrolled, course.Progress,
        course.Sections.OrderBy(section => section.Order).ToList());
}
