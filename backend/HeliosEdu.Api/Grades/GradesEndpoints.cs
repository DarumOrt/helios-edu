using System.Security.Claims;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Grades;

// Сданные работы и журнал оценок — те же пути и ответы, что у маршрутов Next на моках
// (src/app/api/assignment, submissions, gradebook). Права — как shared/auth/permissions.ts:
// сдаёт студент; проверяют преподаватель (свой курс) и администратор; журнал смотрит ещё организатор.
public static class GradesEndpoints
{
    private static Account Actor(HttpContext context) => (Account)context.Items[typeof(Account)]!;
    private static string NewId() => $"sub-{Guid.NewGuid().ToString("N")[..8]}";

    public static void MapGradesEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api").RequireAuthorization().AddEndpointFilter<ManagementWriteFilter>();
        group.MapPost("/assignment/{activityId}/submit", SubmitAsync).Produces<SubmitResult>(201);
        group.MapGet("/assignment/{activityId}/submission", MySubmissionAsync).Produces<MySubmission>();
        group.MapGet("/submissions", ListAsync).Produces<SubmissionList>();
        group.MapPost("/submissions/{id}/review", ReviewAsync).Produces<SubmissionInfo>();
        group.MapGet("/gradebook", CourseGradesAsync).Produces<GradeRow[]>();
        group.MapPost("/gradebook/grade", SetGradeAsync).Produces<GradeRow>();
        group.MapGet("/gradebook/me", MyGradesAsync).Produces<StudentGrades>();
    }

    private static Task<Course?> VisibleCourse(LearningDbContext db, ClaimsPrincipal user, string courseId, CancellationToken token) =>
        AccessRules.VisibleCourses(db, user).AsNoTracking().AsSplitQuery()
            .Include(course => course.Sections.OrderBy(section => section.Order))
            .ThenInclude(section => section.Activities.OrderBy(activity => EF.Property<int>(activity, "Position")))
            .SingleOrDefaultAsync(course => course.Id == courseId, token);

    private static Activity? Material(Course course, string activityId) =>
        course.Sections.SelectMany(section => section.Activities).FirstOrDefault(activity => activity.Id == activityId);

    /// <summary>Задания и тесты курса — колонки журнала, в порядке курса (порядок задаёт загрузка курса).</summary>
    private static List<Activity> GradedItems(Course course) =>
        course.Sections.SelectMany(section => section.Activities)
            .Where(activity => activity.Type is "assignment" or "quiz").ToList();

    private static int MaxOf(Activity activity) => activity.MaxGrade ?? 100;

    // ---- сдача задания ----

    private static async Task<IResult> SubmitAsync(string activityId, HttpContext context, LearningDbContext db)
    {
        var actor = Actor(context);
        if (actor.Role != "student") return Fail(403, "Недостаточно прав");
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var course = await VisibleCourse(db, context.User, input.Text("courseId"), context.RequestAborted);
        if (course is null || Material(course, activityId)?.Type != "assignment") return Fail(404, "not found");
        var text = input.Text("text");
        var fileName = input.OptionalText("fileName") is { } file ? file[..Math.Min(file.Length, 200)] : null;
        if (text.Length == 0 && fileName is null)
            return Fail(400, "Добавьте ответ или файл", new() { ["text"] = "Добавьте ответ или файл" });
        if (text.Length > 20000)
            return Fail(400, "Ответ — до 20 000 символов", new() { ["text"] = "Ответ — до 20 000 символов" });

        var submission = await db.Submissions.SingleOrDefaultAsync(item => item.CourseId == course.Id &&
            item.ActivityId == activityId && item.UserId == actor.Id, context.RequestAborted);
        if (submission?.Status == "reviewed") return Fail(409, "Работа уже проверена — пересдать её нельзя");
        if (submission is null)
        {
            submission = new Submission { Id = NewId(), CourseId = course.Id, ActivityId = activityId, UserId = actor.Id };
            db.Submissions.Add(submission);
        }
        submission.Text = text;
        submission.FileName = fileName;
        submission.Status = "submitted";
        submission.SubmittedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Json(new SubmitResult(submission.Id, submission.Status), statusCode: 201);
    }

    /// <summary>Своя работа по заданию — статус, текст, оценка и комментарий. Не сдавал — пустой ответ.</summary>
    private static async Task<IResult> MySubmissionAsync(string activityId, string? courseId, HttpContext context,
        LearningDbContext db)
    {
        var actor = Actor(context);
        if (actor.Role != "student") return Fail(403, "Недостаточно прав");
        var course = string.IsNullOrEmpty(courseId) ? null : await VisibleCourse(db, context.User, courseId, context.RequestAborted);
        if (course is null || Material(course, activityId)?.Type != "assignment") return Fail(404, "not found");
        var submission = await db.Submissions.AsNoTracking().SingleOrDefaultAsync(item => item.CourseId == course.Id &&
            item.ActivityId == activityId && item.UserId == actor.Id, context.RequestAborted);
        return Results.Ok(new MySubmission(submission is null ? null
            : (await Describe(db, [submission], context.RequestAborted))[0]));
    }

    // ---- проверка работ ----

    private static bool CanReview(Account actor) => actor.Role is "admin" or "tutor";

    private static async Task<List<SubmissionInfo>> Describe(LearningDbContext db, IEnumerable<Submission> submissions,
        CancellationToken token)
    {
        var list = submissions.ToList();
        var courseIds = list.Select(item => item.CourseId).Distinct().ToList();
        var courses = await db.Courses.AsNoTracking().AsSplitQuery().Include(course => course.Sections)
            .ThenInclude(section => section.Activities).Where(course => courseIds.Contains(course.Id))
            .ToDictionaryAsync(course => course.Id, token);
        var userIds = list.Select(item => item.UserId).Distinct().ToList();
        var users = await db.Accounts.AsNoTracking().Where(account => userIds.Contains(account.Id))
            .ToDictionaryAsync(account => account.Id, token);
        var keys = list.Select(item => item.CourseId + "/" + item.ActivityId + "/" + item.UserId).ToHashSet();
        var grades = (await db.Grades.AsNoTracking().Where(grade => courseIds.Contains(grade.CourseId)).ToListAsync(token))
            .Where(grade => keys.Contains(grade.CourseId + "/" + grade.ActivityId + "/" + grade.UserId))
            .ToDictionary(grade => grade.CourseId + "/" + grade.ActivityId + "/" + grade.UserId, grade => grade.Value);
        return list.Select(item =>
        {
            var course = courses.GetValueOrDefault(item.CourseId);
            var activity = course is null ? null : Material(course, item.ActivityId);
            var user = users.GetValueOrDefault(item.UserId);
            return new SubmissionInfo(item.Id, item.ActivityId, item.CourseId, item.UserId, item.Text, item.FileName,
                item.Status, grades.TryGetValue(item.CourseId + "/" + item.ActivityId + "/" + item.UserId, out var grade) ? grade : null,
                item.Feedback, item.SubmittedAt, user?.Name ?? "Студент", user?.Group, activity?.Title ?? item.ActivityId,
                course?.Title ?? "", activity is null ? 100 : MaxOf(activity));
        }).ToList();
    }

    private static async Task<IResult> ListAsync(string? status, HttpContext context, LearningDbContext db)
    {
        if (!CanReview(Actor(context))) return Fail(403, "Недостаточно прав");
        var visible = AccessRules.VisibleCourses(db, context.User).Select(course => course.Id);
        var query = db.Submissions.AsNoTracking().Where(item => visible.Contains(item.CourseId));
        if (!string.IsNullOrEmpty(status)) query = query.Where(item => item.Status == status);
        var items = await query.OrderByDescending(item => item.SubmittedAt).ToListAsync(context.RequestAborted);
        return Results.Ok(new SubmissionList(await Describe(db, items, context.RequestAborted)));
    }

    private static async Task<IResult> ReviewAsync(string id, HttpContext context, LearningDbContext db)
    {
        var actor = Actor(context);
        if (!CanReview(actor)) return Fail(403, "Недостаточно прав");
        var submission = await db.Submissions.SingleOrDefaultAsync(item => item.Id == id, context.RequestAborted);
        var course = submission is null ? null : await VisibleCourse(db, context.User, submission.CourseId, context.RequestAborted);
        if (submission is null || course is null) return Fail(404, "not found");
        var max = Material(course, submission.ActivityId) is { } activity ? MaxOf(activity) : 100;
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var fields = new Dictionary<string, string>();
        var grade = input.Number("grade");
        if (grade is not { } value || value < 0 || value > max) fields["grade"] = $"Оценка — число от 0 до {max}";
        if (input.Text("feedback").Length > 2000) fields["feedback"] = "Комментарий — до 2000 символов";
        if (fields.Count > 0) return Invalid(fields);

        submission.Status = "reviewed";
        submission.Feedback = input.Text("feedback");
        submission.ReviewedBy = actor.Id;
        submission.ReviewedAt = DateTimeOffset.UtcNow;
        await SaveGrade(db, submission.CourseId, submission.ActivityId, submission.UserId, grade!.Value, actor.Id, context.RequestAborted);
        var info = (await Describe(db, [submission], context.RequestAborted))[0] with { Grade = grade, Status = "reviewed" };
        // ученик узнаёт об оценке в колокольчике
        db.Notifications.Add(new Notifications.Notification { Id = $"n-{Guid.NewGuid().ToString("N")[..8]}",
            UserId = submission.UserId, Type = "grade", Title = "Оценка выставлена",
            Body = $"{info.AssignmentTitle}: {grade:0.#} из {max}", Link = "/gradebook", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(info);
    }

    private static async Task SaveGrade(LearningDbContext db, string courseId, string activityId, string userId,
        double value, string actorId, CancellationToken token)
    {
        var row = await db.Grades.SingleOrDefaultAsync(grade => grade.CourseId == courseId &&
            grade.ActivityId == activityId && grade.UserId == userId, token);
        if (row is null)
        {
            row = new Grade { CourseId = courseId, ActivityId = activityId, UserId = userId };
            db.Grades.Add(row);
        }
        row.Value = value;
        row.GradedBy = actorId;
        row.GradedAt = DateTimeOffset.UtcNow;
    }

    // ---- журнал оценок ----

    private static Task<List<Account>> Students(LearningDbContext db, string courseId, CancellationToken token) =>
        AccessRules.CourseStudents(db, courseId).AsNoTracking().OrderBy(account => account.Name).ToListAsync(token);

    /// <summary>Оценки ученика по колонкам: поставленная преподавателем, иначе для теста — лучшая попытка.</summary>
    private static async Task<Dictionary<string, Dictionary<string, double>>> Marks(LearningDbContext db, string courseId,
        IReadOnlyCollection<string> userIds, CancellationToken token)
    {
        var result = userIds.ToDictionary(id => id, _ => new Dictionary<string, double>());
        var attempts = await db.QuizAttempts.AsNoTracking().Where(attempt => attempt.CourseId == courseId &&
            attempt.SubmittedAt != null && attempt.Max > 0 && userIds.Contains(attempt.UserId)).ToListAsync(token);
        foreach (var attempt in attempts)
        {
            var percent = Math.Round(100d * (attempt.Score ?? 0) / attempt.Max, MidpointRounding.AwayFromZero);
            var marks = result[attempt.UserId];
            if (!marks.TryGetValue(attempt.ActivityId, out var best) || percent > best) marks[attempt.ActivityId] = percent;
        }
        foreach (var grade in await db.Grades.AsNoTracking().Where(grade => grade.CourseId == courseId &&
                     userIds.Contains(grade.UserId)).ToListAsync(token))
            result[grade.UserId][grade.ActivityId] = grade.Value;
        return result;
    }

    private static (List<GradeItem> Items, double Total) Row(List<Activity> columns, Dictionary<string, double> marks)
    {
        var items = columns.Select(activity => new GradeItem(activity.Id, activity.Title,
            marks.TryGetValue(activity.Id, out var value) ? value : null, MaxOf(activity))).ToList();
        // итог — средний процент по всем колонкам, непроставленная оценка считается нулём (как в моках)
        var total = items.Count == 0 ? 0 : Math.Round(items.Average(item => 100d * (item.Grade ?? 0) / item.Max), 1,
            MidpointRounding.AwayFromZero);
        return (items, total);
    }

    private static async Task<IResult> CourseGradesAsync(string? courseId, HttpContext context, LearningDbContext db)
    {
        if (Actor(context).Role == "student") return Fail(403, "Недостаточно прав");
        if (string.IsNullOrEmpty(courseId)) return Fail(400, "courseId required");
        var course = await VisibleCourse(db, context.User, courseId, context.RequestAborted);
        if (course is null) return Fail(404, "not found");
        var students = await Students(db, course.Id, context.RequestAborted);
        var marks = await Marks(db, course.Id, students.Select(student => student.Id).ToList(), context.RequestAborted);
        var columns = GradedItems(course);
        return Results.Ok(students.Select(student =>
        {
            var (items, total) = Row(columns, marks[student.Id]);
            return new GradeRow(student.Id, student.Name, items, total);
        }));
    }

    private static async Task<IResult> SetGradeAsync(HttpContext context, LearningDbContext db)
    {
        var actor = Actor(context);
        if (!CanReview(actor)) return Fail(403, "Недостаточно прав");
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var course = await VisibleCourse(db, context.User, input.Text("courseId"), context.RequestAborted);
        var activity = course is null ? null : Material(course, input.Text("itemId"));
        var student = course is null ? null : (await Students(db, course.Id, context.RequestAborted))
            .SingleOrDefault(account => account.Id == input.Text("userId"));
        if (course is null || activity is null || activity.Type is not ("assignment" or "quiz") || student is null)
            return Fail(404, "not found");
        var grade = input.Number("grade");
        if (input.Has("grade") && input.Value("grade")?.ValueKind != System.Text.Json.JsonValueKind.Null &&
            (grade is not { } value || value < 0 || value > MaxOf(activity)))
            return Invalid(new() { ["grade"] = $"Оценка — число от 0 до {MaxOf(activity)}" });

        if (grade is { } set) await SaveGrade(db, course.Id, activity.Id, student.Id, set, actor.Id, context.RequestAborted);
        else
            // пустая оценка — снять поставленную вручную (для теста вернётся лучшая попытка)
            await db.Grades.Where(row => row.CourseId == course.Id && row.ActivityId == activity.Id && row.UserId == student.Id)
                .ExecuteDeleteAsync(context.RequestAborted);
        await db.SaveChangesAsync(context.RequestAborted);
        var marks = await Marks(db, course.Id, [student.Id], context.RequestAborted);
        var (items, total) = Row(GradedItems(course), marks[student.Id]);
        return Results.Ok(new GradeRow(student.Id, student.Name, items, total));
    }

    private static async Task<IResult> MyGradesAsync(HttpContext context, LearningDbContext db)
    {
        var actor = Actor(context);
        if (actor.Role != "student") return Fail(403, "Недостаточно прав");
        // Оценки принадлежат ученику, а не группе: курс, где он сдавал работы и тесты, остаётся в списке
        // и после перевода в другую группу, и после архивации курса (черновик ученик не видит).
        var visible = AccessRules.VisibleCourses(db, context.User).Select(course => course.Id);
        var mine = db.Grades.Where(grade => grade.UserId == actor.Id).Select(grade => grade.CourseId)
            .Union(db.Submissions.Where(item => item.UserId == actor.Id).Select(item => item.CourseId))
            .Union(db.QuizAttempts.Where(item => item.UserId == actor.Id && item.SubmittedAt != null).Select(item => item.CourseId));
        var courses = await db.Courses.Where(course => visible.Contains(course.Id) ||
                course.Status != "draft" && mine.Contains(course.Id)).AsNoTracking().AsSplitQuery()
            .Include(course => course.Sections.OrderBy(section => section.Order))
            .ThenInclude(section => section.Activities.OrderBy(activity => EF.Property<int>(activity, "Position")))
            .OrderBy(course => EF.Property<int>(course, "Position")).ToListAsync(context.RequestAborted);
        var result = new List<StudentCourseGrades>();
        foreach (var course in courses)
        {
            var columns = GradedItems(course);
            if (columns.Count == 0) continue;
            var marks = await Marks(db, course.Id, [actor.Id], context.RequestAborted);
            var (items, total) = Row(columns, marks[actor.Id]);
            result.Add(new StudentCourseGrades(course.Id, course.Title, course.Code, items, total));
        }
        return Results.Ok(new StudentGrades(result));
    }
}
