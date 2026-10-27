namespace HeliosEdu.Api.Grades;

// Сданное задание. Одна работа на ученика и задание: пересдача до проверки заменяет текст.
public sealed class Submission
{
    public string Id { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string ActivityId { get; set; } = "";
    public string UserId { get; set; } = "";
    public string Text { get; set; } = "";
    public string? FileName { get; set; }
    public string Status { get; set; } = "submitted";
    public DateTimeOffset SubmittedAt { get; set; }
    public string? Feedback { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
}

// Оценка за материал курса (задание или тест), поставленная преподавателем. Для теста без оценки
// в журнале показывается лучший результат попыток P5.
public sealed class Grade
{
    public string CourseId { get; set; } = "";
    public string ActivityId { get; set; } = "";
    public string UserId { get; set; } = "";
    public double Value { get; set; }
    public string GradedBy { get; set; } = "";
    public DateTimeOffset GradedAt { get; set; }
}

// Ответы — в формате src/shared/types/domain.ts (Submission, GradeRow) и src/mocks/gradebook-store.ts.
public sealed record SubmissionInfo(string Id, string AssignmentId, string CourseId, string UserId, string Text,
    string? FileName, string Status, double? Grade, string? Feedback, DateTimeOffset SubmittedAt,
    string UserName, string? Group, string AssignmentTitle, string CourseTitle, int MaxGrade);

public sealed record SubmissionList(IReadOnlyList<SubmissionInfo> Items);
public sealed record SubmitResult(string Id, string Status);
public sealed record MySubmission(SubmissionInfo? Submission);
public sealed record GradeItem(string ItemId, string ItemTitle, double? Grade, int Max);
public sealed record GradeRow(string UserId, string UserName, IReadOnlyList<GradeItem> Items, double Total);
public sealed record StudentCourseGrades(string CourseId, string CourseTitle, string CourseCode,
    IReadOnlyList<GradeItem> Items, double Total);
public sealed record StudentGrades(IReadOnlyList<StudentCourseGrades> Courses);
