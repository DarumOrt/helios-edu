namespace HeliosEdu.Api.Courses;

// Формат совместим с shared/types/domain.ts; поля EF не попадают в ответы.
public record CourseSummary(
    string Id, string Code, string Title, string Description, string? Cover,
    string Category, string TutorId, int Enrolled, int? Progress, string Status, string? CoverColor,
    string? Faculty, string? AcademicYear)
{
    public static CourseSummary From(Course course, CourseStats stats) => new(course.Id, course.Code, course.Title,
        course.Description, course.Cover, course.Category, course.TutorId, stats.Enrolled,
        stats.Progress, course.Status, course.CoverColor, course.Faculty, course.AcademicYear);
}

public sealed record CourseDetail(
    string Id, string Code, string Title, string Description, string? Cover,
    string Category, string TutorId, int Enrolled, int? Progress,
    IReadOnlyList<Section> Sections, string Status, string? CoverColor, string? Faculty, string? AcademicYear)
    : CourseSummary(Id, Code, Title, Description, Cover, Category, TutorId, Enrolled, Progress, Status, CoverColor,
        Faculty, AcademicYear)
{
    public static CourseDetail FromDetail(Course course, CourseStats stats)
    {
        // «пройдено» — у ученика своё; преподавателю и управлению не показываем
        foreach (var activity in course.Sections.SelectMany(section => section.Activities))
            activity.Completed = stats.Completed?.Contains(activity.Id) == true ? true : null;
        return new(course.Id, course.Code, course.Title, course.Description, course.Cover,
            course.Category, course.TutorId, stats.Enrolled, stats.Progress,
            course.Sections.OrderBy(section => section.Order).ToList(), course.Status, course.CoverColor,
            course.Faculty, course.AcademicYear);
    }
}
