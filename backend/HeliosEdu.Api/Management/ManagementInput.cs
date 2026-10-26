using System.Text.Json;
using System.Text.RegularExpressions;
using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HeliosEdu.Api.Management;

// PATCH различает отсутствующее поле и null; неизвестные поля не применяются.
public sealed class ManagementInput(JsonElement body)
{
    public bool Has(string name) => body.TryGetProperty(name, out _);
    public JsonElement? Value(string name) => body.TryGetProperty(name, out var value) ? value : null;
    public string Text(string name) => Value(name) is { ValueKind: JsonValueKind.String } value
        ? value.GetString()!.Trim() : "";
    public string? OptionalText(string name) => Text(name) is { Length: > 0 } text ? text : null;
    public string Choice(string name, string fallback = "") => Value(name) is not { } value || value.ValueKind == JsonValueKind.Null
        ? fallback : value.ValueKind == JsonValueKind.String ? value.GetString()! : "";
    public string[]? Ids(string name)
    {
        if (Value(name) is not { ValueKind: JsonValueKind.Array } value) return null;
        if (value.EnumerateArray().Any(item => item.ValueKind != JsonValueKind.String)) return null;
        return value.EnumerateArray().Select(item => item.GetString()!).Distinct().ToArray();
    }

    public static async Task<ManagementInput?> ReadAsync(HttpRequest request)
    {
        try
        {
            using var document = await JsonDocument.ParseAsync(request.Body, cancellationToken: request.HttpContext.RequestAborted);
            return document.RootElement.ValueKind == JsonValueKind.Object
                ? new ManagementInput(document.RootElement.Clone()) : null;
        }
        catch (JsonException) { return null; }
    }
}

public static class ManagementValidation
{
    public static readonly string[] Roles = ["student", "tutor", "organizer", "admin"];
    public static readonly string[] UserStatuses = ["active", "blocked"];
    public static readonly string[] CourseStatuses = ["draft", "published", "archived"];
    public static readonly string[] CoverColors = ["sky", "teal", "apricot", "iris", "sun", "rose"];
    private static readonly Regex Email = Pattern(@"^[^\s@]+@[^\s@]+\.[^\s@]+$");
    private static readonly Regex GroupName = Pattern(@"^[\p{L}0-9][\p{L}0-9 -]{1,29}$");
    private static readonly Regex Code = Pattern(@"^[А-ЯЁA-Z]{2,6}-[0-9]{3}$");
    private static Regex Pattern(string pattern) => new(pattern, RegexOptions.CultureInvariant | RegexOptions.NonBacktracking,
        TimeSpan.FromSeconds(1));

    public static Dictionary<string, string> User(ManagementInput input, bool partial, string role)
    {
        var fields = new Dictionary<string, string>();
        if ((!partial || input.Has("name")) && input.Text("name").Length is < 2 or > 100)
            fields["name"] = "Укажите имя и фамилию — от 2 до 100 символов";
        var email = input.Text("email");
        if ((!partial || input.Has("email")) && (email.Length > 254 || !Email.IsMatch(email)))
            fields["email"] = "Почта выглядит неполной, например name@pspu.ru";
        if (!Roles.Contains(role)) fields["role"] = "Выберите роль";
        if (input.Has("status") && !UserStatuses.Contains(input.Choice("status"))) fields["status"] = "Неизвестный статус";
        if (input.Text("faculty").Length > 50) fields["faculty"] = "Факультет — до 50 символов";
        if (input.OptionalText("group") is not null && role != "student") fields["group"] = "Группу можно назначить только студенту";
        return fields;
    }

    public static Dictionary<string, string> Cohort(ManagementInput input, bool partial)
    {
        var fields = new Dictionary<string, string>();
        if ((!partial || input.Has("name")) && !GroupName.IsMatch(input.Text("name")))
            fields["name"] = "Название — от 2 до 30 символов: буквы, цифры, дефис, например М1227";
        if (input.Text("faculty").Length > 50) fields["faculty"] = "Факультет — до 50 символов";
        return fields;
    }

    public static Dictionary<string, string> Course(ManagementInput input, bool partial)
    {
        var fields = new Dictionary<string, string>();
        // Как в моках: перед проверкой новый код приводится к верхнему регистру.
        if (!partial && !Code.IsMatch(input.Text("code").ToUpperInvariant()))
            fields["code"] = "Код — заглавные буквы, дефис и три цифры, например МАТ-101";
        if ((!partial || input.Has("title")) && input.Text("title").Length is < 3 or > 120)
            fields["title"] = "Название — от 3 до 120 символов";
        if ((!partial || input.Has("category")) && input.Text("category").Length is < 2 or > 50)
            fields["category"] = "Укажите направление, например Математика";
        if ((!partial || input.Has("description")) && input.Text("description").Length > 1000)
            fields["description"] = "Описание — до 1000 символов";
        if ((!partial || input.Has("tutorId")) && input.Text("tutorId").Length == 0)
            fields["tutorId"] = "Назначьте преподавателя";
        if (partial && input.Has("status") && !CourseStatuses.Contains(input.Choice("status")))
            fields["status"] = "Неизвестный статус";
        return fields;
    }

    public static IResult Fail(int status, string error, Dictionary<string, string>? fields = null) =>
        Results.Json(new { error, fields }, statusCode: status);
    public static IResult Invalid(Dictionary<string, string> fields) => Fail(400, "Проверьте поля формы", fields);
    public static IResult Duplicate(string field, string error) => Fail(409, error, new() { [field] = error });
}

// Все изменения управления атомарны. Уникальные индексы защищают и параллельные запросы.
public sealed class ManagementWriteFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        if (HttpMethods.IsGet(http.Request.Method) || HttpMethods.IsHead(http.Request.Method)) return await next(context);
        if (http.Request.Headers["X-Helios-Client"] != "web")
            return ManagementValidation.Fail(403, "Недостаточно прав");
        var db = http.RequestServices.GetRequiredService<LearningDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync(http.RequestAborted);
        try
        {
            var result = await next(context);
            if (result is IStatusCodeHttpResult { StatusCode: >= 400 }) await transaction.RollbackAsync(http.RequestAborted);
            else await transaction.CommitAsync(http.RequestAborted);
            return result;
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            await transaction.RollbackAsync(http.RequestAborted);
            var constraint = ((PostgresException)exception.InnerException!).ConstraintName;
            return constraint switch
            {
                "IX_Accounts_NormalizedEmail" => ManagementValidation.Duplicate("email", "Эта почта уже зарегистрирована"),
                "IX_Courses_Code" => ManagementValidation.Duplicate("code", "Курс с таким кодом уже есть"),
                "IX_Cohorts_TenantId_NormalizedName" => ManagementValidation.Duplicate("name", "Группа с таким названием уже есть"),
                _ => throw new InvalidOperationException("Неизвестное ограничение уникальности.", exception)
            };
        }
    }
}
