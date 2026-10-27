using System.Text.Json;

namespace HeliosEdu.Api.Adaptive;

public sealed class Skill
{
    public string Id { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string? SectionId { get; set; }
    public string? Code { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public int Order { get; set; }
    public bool IsAuto { get; set; }
    public double PInit { get; set; } = .3;
    public double PLearn { get; set; } = .15;
    public double PSlip { get; set; } = .1;
    public double PGuess { get; set; } = .2;
}

public sealed class SkillPrerequisite
{
    public string SkillId { get; set; } = "";
    public string RequiresSkillId { get; set; } = "";
}

public sealed class ActivitySkill
{
    public string CourseId { get; set; } = "";
    public string ActivityId { get; set; } = "";
    public string SkillId { get; set; } = "";
}

public sealed class QuizQuestion
{
    public string Id { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string ActivityId { get; set; } = "";
    public string Type { get; set; } = "";
    public string Text { get; set; } = "";
    public JsonElement Options { get; set; } = JsonSerializer.SerializeToElement(Array.Empty<string>());
    public JsonElement Correct { get; set; } = JsonSerializer.SerializeToElement<object?>(null);
    public JsonElement Hints { get; set; } = JsonSerializer.SerializeToElement(Array.Empty<string>());
    public string? SkillId { get; set; }
    public int Order { get; set; }
}

public sealed class QuizAttempt
{
    public string Id { get; set; } = "";
    public string UserId { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string ActivityId { get; set; } = "";
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public int? Score { get; set; }
    public int Max { get; set; }
    // Снимок не меняется при редактировании теста: ответы и подсказки относятся к начатой версии.
    public JsonElement Questions { get; set; }
    public JsonElement HintCounts { get; set; } = JsonSerializer.SerializeToElement(new Dictionary<string, int>());
}

public sealed class AttemptAnswer
{
    public string AttemptId { get; set; } = "";
    public string QuestionId { get; set; } = "";
    public JsonElement Given { get; set; }
    public bool IsCorrect { get; set; }
    public int HintsUsed { get; set; }
    public DateTimeOffset AnsweredAt { get; set; }
}

public sealed class LearningEvent
{
    public long Id { get; set; }
    public DateTimeOffset At { get; set; }
    public string UserId { get; set; } = "";
    public string ActorId { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string? ActivityId { get; set; }
    public string? SkillId { get; set; }
    public string Type { get; set; } = "";
    public JsonElement Payload { get; set; }
}

public sealed class SkillMastery
{
    public string UserId { get; set; } = "";
    public string SkillId { get; set; } = "";
    public double PKnown { get; set; }
    public int Attempts { get; set; }
    public int Correct { get; set; }
    public string Status { get; set; } = "learning";
    public bool UnlockedByTeacher { get; set; }
    public DateTimeOffset? MasteredAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Recommendation
{
    public string Id { get; set; } = "";
    public string UserId { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string? ActivityId { get; set; }
    public string? SkillId { get; set; }
    public string ReasonCode { get; set; } = "";
    public string ReasonText { get; set; } = "";
    public string Status { get; set; } = "shown";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class StudentPin
{
    public string UserId { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string ActivityId { get; set; } = "";
    public string Reason { get; set; } = "";
    public string CreatedBy { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed record SkillInfo(string Id, string CourseId, string? SectionId, string? Code, string Title,
    string? Description, int Order, bool IsAuto, double PInit, double PLearn, double PSlip, double PGuess,
    string[] PrerequisiteIds, string[] ActivityIds);
public sealed record AttemptQuestion(QuizQuestion Question, string[] SkillIds);
