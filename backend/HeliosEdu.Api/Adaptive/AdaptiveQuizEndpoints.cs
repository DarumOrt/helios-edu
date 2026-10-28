using HeliosEdu.Api.Audit;
using System.Text.Json;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Adaptive;

public static partial class AdaptiveEndpoints
{
    private static IResult? QuizError(HttpContext http, string activityId)
    {
        var material = AdaptiveEngine.Materials(Current(http)).FirstOrDefault(item => item.Activity.Id == activityId).Activity;
        return material is null ? Fail(404, "Материал не найден") : material.Type != "quiz"
            ? Invalid(new() { ["activityId"] = "Это не тест" }) : null;
    }

    private static object StudentQuestion(QuizQuestion question) => new { question.Id, question.Type, question.Text,
        question.Options, question.SkillId, question.Order, hintsCount = question.Hints.GetArrayLength() };

    private static async Task<IResult> GetQuestions(string activityId, HttpContext http, LearningDbContext db)
    {
        if (QuizError(http, activityId) is { } error) return error;
        var id = Current(http).Id;
        var questions = await db.QuizQuestions.Where(item => item.CourseId == id && item.ActivityId == activityId).OrderBy(item => item.Order).ThenBy(item => item.Id).ToListAsync(http.RequestAborted);
        return Actor(http).Role == "student" ? Results.Ok(questions.Select(StudentQuestion)) : Results.Ok(questions);
    }

    private static async Task<IResult> PutQuestions(string activityId, HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        if (QuizError(http, activityId) is { } error) return error;
        JsonElement body;
        try
        {
            using var document = await JsonDocument.ParseAsync(http.Request.Body, cancellationToken: http.RequestAborted);
            body = document.RootElement.Clone();
        }
        catch (JsonException) { return BadBody(); }
        if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("questions", out var array)) body = array;
        if (body.ValueKind != JsonValueKind.Array) return BadBody();
        var course = Current(http); var token = http.RequestAborted;
        var skills = await db.Skills.Where(item => item.CourseId == course.Id).Select(item => item.Id).ToListAsync(token);
        var errors = new Dictionary<string, string>();
        var parsed = new List<QuizQuestion>();
        var seen = new HashSet<string>();
        foreach (var (element, index) in body.EnumerateArray().Select((item, index) => (item, index)))
        {
            var prefix = $"questions.{index}.";
            if (element.ValueKind != JsonValueKind.Object) { errors[prefix + "text"] = "Текст вопроса — до 2000 символов"; continue; }
            var input = new ManagementInput(element);
            var type = input.Text("type");
            if (type is not ("mcq" or "short" or "boolean")) errors[prefix + "type"] = "Неизвестный тип вопроса";
            var text = input.Text("text");
            if (text.Length is < 1 or > 2000) errors[prefix + "text"] = "Текст вопроса — до 2000 символов";
            var options = input.Value("options") ?? AdaptiveJson.Pack(Array.Empty<string>());
            var validOptions = options.ValueKind == JsonValueKind.Array && options.GetArrayLength() is >= 2 and <= 8 &&
                options.EnumerateArray().All(item => item.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(item.GetString()));
            if (type == "mcq" && !validOptions) errors[prefix + "options"] = "У вопроса с выбором — от 2 до 8 вариантов";
            if (type != "mcq") options = AdaptiveJson.Pack(Array.Empty<string>());
            var correct = input.Value("correct") ?? AdaptiveJson.Pack<object?>(null);
            var validCorrect = type switch
            {
                "mcq" => correct.ValueKind == JsonValueKind.Number && correct.TryGetInt32(out var choice) && choice >= 0 && validOptions && choice < options.GetArrayLength(),
                "short" => correct.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(correct.GetString()),
                "boolean" => correct.ValueKind is JsonValueKind.True or JsonValueKind.False,
                _ => false
            };
            if (!validCorrect) errors[prefix + "correct"] = "Укажите правильный ответ";
            var hints = input.Value("hints") ?? AdaptiveJson.Pack(Array.Empty<string>());
            if (hints.ValueKind != JsonValueKind.Array || hints.GetArrayLength() > 3 ||
                hints.EnumerateArray().Any(item => item.ValueKind != JsonValueKind.String || item.GetString()!.Length > 500))
                errors[prefix + "hints"] = "Не больше 3 подсказок до 500 символов";
            var skillId = input.OptionalText("skillId");
            if (!StringOrNull(input, "skillId") || skillId is not null && !skills.Contains(skillId))
                errors[prefix + "skillId"] = "Навык должен быть из этого курса";
            var id = input.Has("id") ? input.Text("id") : AdaptiveEngine.Id("q");
            if (id.Length is < 1 or > 100 || !seen.Add(id)) errors[prefix + "id"] = "Идентификаторы вопросов должны быть уникальными";
            parsed.Add(new QuizQuestion { Id = id, CourseId = course.Id, ActivityId = activityId, Type = type, Text = text,
                Options = options, Correct = correct, Hints = hints, SkillId = skillId, Order = index + 1 });
        }
        if (errors.Count > 0) return Invalid(errors);
        var existing = await db.QuizQuestions.Where(item => item.CourseId == course.Id && item.ActivityId == activityId).ToListAsync(token);
        db.QuizQuestions.RemoveRange(existing.Where(item => parsed.All(question => question.Id != item.Id)));
        foreach (var question in parsed)
        {
            var old = existing.SingleOrDefault(item => item.Id == question.Id);
            if (old is null) db.QuizQuestions.Add(question);
            else db.Entry(old).CurrentValues.SetValues(question);
        }
        var quizTitle = AdaptiveEngine.Materials(course).First(item => item.Activity.Id == activityId).Activity.Title;
        AuditLog.Write(db, http, "quiz.questions", "activity", activityId, $"{course.Code} · {quizTitle}",
            AuditLog.Diff(("Вопросов", existing.Count.ToString(), parsed.Count.ToString())));
        await TeacherCourseChange(http, db, engine, "quiz.questions", token);
        return Results.Ok(parsed);
    }

    /// <summary>Свои попытки теста: сколько можно, сколько завершено, есть ли начатая, лучший результат.</summary>
    private static async Task<IResult> Attempts(string activityId, HttpContext http, LearningDbContext db)
    {
        if (QuizError(http, activityId) is { } error) return error;
        var course = Current(http); var userId = Actor(http).Id;
        var mine = await db.QuizAttempts.AsNoTracking().Where(item => item.CourseId == course.Id &&
            item.ActivityId == activityId && item.UserId == userId).ToListAsync(http.RequestAborted);
        var done = mine.Where(item => item.SubmittedAt != null && item.Max > 0).ToList();
        int? best = done.Count == 0 ? null : done.Max(item =>
            (int)Math.Round(100d * (item.Score ?? 0) / item.Max, MidpointRounding.AwayFromZero));
        return Results.Ok(new AttemptsSummary(Quiz(course, activityId).MaxAttempts, done.Count,
            mine.Any(item => item.SubmittedAt == null), best));
    }

    private static Courses.Activity Quiz(Courses.Course course, string activityId) =>
        course.Sections.SelectMany(section => section.Activities).First(item => item.Id == activityId);

    private static async Task<IResult> StartAttempt(string activityId, HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        if (QuizError(http, activityId) is { } error) return error;
        var course = Current(http); var userId = Actor(http).Id; var token = http.RequestAborted;
        var existing = await db.QuizAttempts.SingleOrDefaultAsync(item => item.CourseId == course.Id && item.ActivityId == activityId && item.UserId == userId && item.SubmittedAt == null, token);
        if (existing is not null) return Results.Ok(new { attemptId = existing.Id, questions = AdaptiveJson.Read<AttemptQuestion[]>(existing.Questions).Select(item => StudentQuestion(item.Question)) });
        if (Quiz(course, activityId).MaxAttempts is { } limit && await db.QuizAttempts.CountAsync(item => item.CourseId == course.Id &&
                item.ActivityId == activityId && item.UserId == userId && item.SubmittedAt != null, token) >= limit)
            return Fail(409, "Попытки закончились");
        var questions = await db.QuizQuestions.Where(item => item.CourseId == course.Id && item.ActivityId == activityId).OrderBy(item => item.Order).ThenBy(item => item.Id).ToListAsync(token);
        if (questions.Count == 0) return Fail(409, "В тесте пока нет вопросов");
        var skills = await db.Skills.Where(item => item.CourseId == course.Id).ToListAsync(token);
        var links = await db.ActivitySkills.Where(item => item.CourseId == course.Id && item.ActivityId == activityId).ToListAsync(token);
        var attempt = new QuizAttempt { Id = AdaptiveEngine.Id("at"), UserId = userId, CourseId = course.Id, ActivityId = activityId,
            StartedAt = DateTimeOffset.UtcNow, Max = questions.Count,
            Questions = AdaptiveJson.Pack(questions.Select(question => new AttemptQuestion(question, AdaptiveEngine.QuestionSkills(question, course, skills, links))).ToArray()) };
        db.QuizAttempts.Add(attempt);
        engine.Event(userId, userId, course.Id, "attempt.started", new { attemptId = attempt.Id, max = attempt.Max }, activityId);
        return Results.Json(new { attemptId = attempt.Id, questions = questions.Select(StudentQuestion) }, statusCode: 201);
    }

    private static async Task<QuizAttempt> Attempt(string attemptId, HttpContext http, LearningDbContext db) =>
        await db.QuizAttempts.SingleAsync(item => item.Id == attemptId && item.UserId == Actor(http).Id, http.RequestAborted);

    private static async Task<IResult> Answer(string attemptId, HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var token = http.RequestAborted;
        var attempt = await Attempt(attemptId, http, db);
        if (attempt.SubmittedAt is not null) return Fail(409, "Попытка уже завершена");
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input is null || !input.Has("given")) return BadBody();
        var snapshot = AdaptiveJson.Read<AttemptQuestion[]>(attempt.Questions).SingleOrDefault(item => item.Question.Id == input.Text("questionId"));
        if (snapshot is null) return Fail(404, "Вопрос не найден");
        var question = snapshot.Question;
        if (await db.AttemptAnswers.AnyAsync(item => item.AttemptId == attemptId && item.QuestionId == question.Id, token)) return Fail(409, "Ответ на этот вопрос уже сохранён");
        var given = input.Value("given")!.Value;
        var validGiven = question.Type switch { "mcq" => given.ValueKind == JsonValueKind.Number && given.TryGetInt32(out var choice) && choice >= 0 && choice < question.Options.GetArrayLength(),
            "boolean" => given.ValueKind is JsonValueKind.True or JsonValueKind.False, "short" => given.ValueKind == JsonValueKind.String, _ => false };
        if (!validGiven) return Invalid(new() { ["given"] = "Ответ не соответствует типу вопроса" });
        var correct = question.Type switch { "mcq" => given.GetInt32() == question.Correct.GetInt32(),
            "boolean" => given.GetBoolean() == question.Correct.GetBoolean(),
            "short" => given.GetString()!.Trim().ToLowerInvariant().Contains(question.Correct.GetString()!.Trim().ToLowerInvariant(), StringComparison.Ordinal), _ => false };
        var counts = AdaptiveJson.Read<Dictionary<string, int>>(attempt.HintCounts);
        var hints = counts.GetValueOrDefault(question.Id);
        db.AttemptAnswers.Add(new AttemptAnswer { AttemptId = attemptId, QuestionId = question.Id, Given = given,
            IsCorrect = correct, HintsUsed = hints, AnsweredAt = DateTimeOffset.UtcNow });
        engine.Event(attempt.UserId, attempt.UserId, attempt.CourseId, "answer.submitted", new { attemptId, questionId = question.Id, isCorrect = correct, hintsUsed = hints }, attempt.ActivityId);
        var sectionId = Current(http).Sections.Find(section => section.Activities.Any(item => item.Id == attempt.ActivityId))?.Id ?? "";
        var allSkills = await engine.EnsureSkills(Current(http), token, sectionId);
        // Модуль мог ещё не иметь авто-навыка на момент начала попытки.
        var ids = snapshot.SkillIds;
        if (ids.Length == 0)
        {
            var links = await db.ActivitySkills.Where(item => item.CourseId == attempt.CourseId && item.ActivityId == attempt.ActivityId).ToListAsync(token);
            ids = AdaptiveEngine.QuestionSkills(question, Current(http), allSkills, links);
        }
        var changes = await engine.Learn(attempt.UserId, attempt.CourseId, question, ids, correct, hints, token);
        return Results.Ok(new { isCorrect = correct, question.Correct, skills = changes });
    }

    private static async Task<IResult> Hint(string attemptId, HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var attempt = await Attempt(attemptId, http, db); var token = http.RequestAborted;
        if (attempt.SubmittedAt is not null) return Fail(409, "Попытка уже завершена");
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input is null) return BadBody();
        var question = AdaptiveJson.Read<AttemptQuestion[]>(attempt.Questions).SingleOrDefault(item => item.Question.Id == input.Text("questionId"))?.Question;
        if (question is null) return Fail(404, "Вопрос не найден");
        if (await db.AttemptAnswers.AnyAsync(item => item.AttemptId == attemptId && item.QuestionId == question.Id, token)) return Fail(409, "Ответ на этот вопрос уже сохранён");
        var counts = AdaptiveJson.Read<Dictionary<string, int>>(attempt.HintCounts);
        var previous = counts.GetValueOrDefault(question.Id);
        if (previous >= question.Hints.GetArrayLength()) return Fail(409, "Подсказок больше нет");
        counts[question.Id] = previous + 1;
        attempt.HintCounts = AdaptiveJson.Pack(counts);
        engine.Event(attempt.UserId, attempt.UserId, attempt.CourseId, "hint.requested", new { attemptId, questionId = question.Id, level = previous + 1 }, attempt.ActivityId);
        return Results.Ok(new { level = previous + 1, text = question.Hints[previous].GetString(), hintsLeft = question.Hints.GetArrayLength() - previous - 1 });
    }

    private static async Task<IResult> Submit(string attemptId, HttpContext http, LearningDbContext db, AdaptiveEngine engine)
    {
        var attempt = await Attempt(attemptId, http, db);
        if (attempt.SubmittedAt is null)
        {
            attempt.Score = await db.AttemptAnswers.CountAsync(item => item.AttemptId == attemptId && item.IsCorrect, http.RequestAborted);
            attempt.SubmittedAt = DateTimeOffset.UtcNow;
            engine.Event(attempt.UserId, attempt.UserId, attempt.CourseId, "attempt.submitted", new { attemptId, score = attempt.Score, max = attempt.Max }, attempt.ActivityId);
        }
        return Results.Ok(new { score = attempt.Score, max = attempt.Max, percent = attempt.Max == 0 ? 0 : (int)Math.Round(100d * attempt.Score!.Value / attempt.Max, MidpointRounding.AwayFromZero) });
    }
}
