using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using HeliosEdu.Api.Management;

namespace HeliosEdu.Api.Courses;

// Зеркало ACTIVITY_FIELDS и pickActivityFields: неизвестные поля не проверяются и не сохраняются.
public sealed class ContentInput
{
    private static readonly Dictionary<string, string[]> Fields = new()
    {
        ["video"] = ["title", "src", "durationMin"],
        ["pdf"] = ["title", "pages", "src"],
        ["presentation"] = ["title", "pages", "src"],
        ["quiz"] = ["title", "due", "durationMin"],
        ["assignment"] = ["title", "due", "description", "maxGrade"]
    };
    private static readonly Regex Source = new(@"^(https://|/)\S+$", RegexOptions.CultureInvariant | RegexOptions.NonBacktracking,
        TimeSpan.FromSeconds(1));
    private readonly Dictionary<string, JsonElement?> values = new();

    public static bool IsType(string type) => Fields.ContainsKey(type);

    public ContentInput(string type, ManagementInput input, bool partial)
    {
        foreach (var key in Fields[type])
        {
            if (!input.Has(key)) continue;
            var value = input.Value(key);
            if (value is { ValueKind: JsonValueKind.String } text)
            {
                var trimmed = text.GetString()!.Trim();
                value = trimmed.Length == 0 && key != "title" ? null : JsonSerializer.SerializeToElement(trimmed);
            }
            if (value is { ValueKind: JsonValueKind.Null }) value = null;
            values[key] = value;
        }
        if (!partial && type == "assignment" && !Provided("maxGrade"))
            values["maxGrade"] = JsonSerializer.SerializeToElement(100);
    }

    private bool Provided(string key) => values.TryGetValue(key, out var value) && value is not null;
    private string? Text(string key) => values.GetValueOrDefault(key) is { ValueKind: JsonValueKind.String } value ? value.GetString() : null;
    private int? Number(string key) => values.GetValueOrDefault(key) is { ValueKind: JsonValueKind.Number } value &&
        value.TryGetDecimal(out var number) && number is >= int.MinValue and <= int.MaxValue && decimal.Truncate(number) == number
            ? (int)number : null;

    private DateTimeOffset? Due()
    {
        if (Text("due") is not { } text || !DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.AssumeUniversal, out var due)) return null;
        // точность как у прежнего строкового срока — до миллисекунд, в UTC
        var utc = due.ToUniversalTime();
        return utc.AddTicks(-(utc.Ticks % TimeSpan.TicksPerMillisecond));
    }

    public Dictionary<string, string> Validate(string type, bool partial)
    {
        var errors = new Dictionary<string, string>();
        if ((!partial || values.ContainsKey("title")) && (Text("title")?.Length ?? 0) is < 2 or > 120)
            errors["title"] = "Название — от 2 до 120 символов";
        if (Provided("due") && Due() is null) errors["due"] = "Укажите дату и время сдачи";
        if (Provided("src") && (Text("src") is not { } src || src.Length > 500 || !Source.IsMatch(src)))
            errors["src"] = "Ссылка на файл: https://… или путь /media/…, до 500 символов";
        foreach (var (key, max, message) in new[] {
            ("pages", 500, "Страниц — от 1 до 500"),
            ("durationMin", 600, "Длительность — от 1 до 600 минут"),
            ("maxGrade", 1000, "Максимальная оценка — от 1 до 1000") })
            if (Provided(key) && (Number(key) is not { } number || number < 1 || number > max)) errors[key] = message;
        if ((Text("description")?.Length ?? 0) > 4000) errors["description"] = "Условие — до 4000 символов";
        if (!partial && type == "video" && string.IsNullOrEmpty(Text("src"))) errors["src"] = "Укажите ссылку на видеофайл";
        if (!partial && type is "pdf" or "presentation" && !Provided("pages")) errors["pages"] = "Укажите число страниц";
        return errors;
    }

    public void Apply(Activity activity)
    {
        foreach (var key in values.Keys)
            switch (key)
            {
                case "title": activity.Title = Text(key)!; break;
                case "src": activity.Src = Text(key); break;
                case "due": activity.Due = Due(); break;
                case "description": activity.Description = Text(key); break;
                case "pages": activity.Pages = Number(key); break;
                case "durationMin": activity.DurationMin = Number(key); break;
                case "maxGrade": activity.MaxGrade = Number(key); break;
            }
    }

    // Для порядка нельзя использовать ManagementInput.Ids: там дубликаты удаляются для состава групп.
    public static string[]? Order(ManagementInput? input, string key, IEnumerable<string> existing)
    {
        if (input?.Value(key) is not { ValueKind: JsonValueKind.Array } value ||
            value.EnumerateArray().Any(item => item.ValueKind != JsonValueKind.String)) return null;
        var ids = value.EnumerateArray().Select(item => item.GetString()!).ToArray();
        var current = existing.ToArray();
        return ids.Length == current.Length && ids.Distinct().Count() == ids.Length && current.All(ids.Contains) ? ids : null;
    }
}
