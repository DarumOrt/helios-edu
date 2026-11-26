using System.Text.Json;

namespace HeliosEdu.Api.Tracking;

// Полуоткрытые интервалы: страницы с нуля или миллисекунды видео; Active — время UTC в мс.
public sealed record MediaRanges(long[][] Watched, long[][] Active, long PositionAt)
{
    public static MediaRanges? Stored(ActivityProgress row) => row.Media?.Deserialize<MediaRanges>(JsonSerializerOptions.Web);

    public static MediaRanges? Parse(JsonElement value, long limit, DateTimeOffset now)
    {
        if (limit <= 0 || value.ValueKind != JsonValueKind.Object) return null;
        MediaRanges? ranges;
        try { ranges = value.Deserialize<MediaRanges>(JsonSerializerOptions.Web); }
        catch (JsonException) { return null; }
        var latest = now.AddMinutes(1).ToUnixTimeMilliseconds();
        return ranges is not null && ranges.PositionAt >= 0 && ranges.PositionAt <= latest &&
            Valid(ranges.Watched, 0, limit) && Valid(ranges.Active, now.AddDays(-7).ToUnixTimeMilliseconds(), latest)
            ? ranges : null;
    }

    private static bool Valid(long[][]? ranges, long min, long max) =>
        ranges is { Length: <= 4096 } && ranges.All(r => r is { Length: 2 } && r[0] >= min && r[0] < r[1] && r[1] <= max);

    private static long[][] Union(long[][] left, long[][] right)
    {
        var result = new List<long[]>();
        foreach (var range in left.Concat(right).OrderBy(r => r[0]))
        {
            if (result.Count > 0 && range[0] <= result[^1][1])
                result[^1][1] = Math.Max(result[^1][1], range[1]);
            else result.Add([range[0], range[1]]);
        }
        return result.ToArray();
    }

    private static long Length(long[][] ranges) => ranges.Sum(r => r[1] - r[0]);

    public void Apply(ActivityProgress row, long limit, int? position)
    {
        var prior = Stored(row) ?? new MediaRanges([], [], 0);
        var watched = Union(prior.Watched, Watched);
        var active = Union(prior.Active, Active);
        var covered = Length(watched);
        var paged = row.ActivityType is "pdf" or "presentation";
        var coverage = (int)Math.Min(100, Math.Floor(covered * 100d / limit + 0.5));
        row.Coverage = Math.Max(row.Coverage, coverage);
        row.Completed |= row.Coverage >= (paged ? 80 : 90);
        if (paged) row.PagesViewed = Math.Max(row.PagesViewed ?? 0, (int)Math.Min(limit, covered));
        row.ActiveTimeSec = (int)Math.Min(604800, row.ActiveTimeSec + Length(active) / 1000 - Length(prior.Active) / 1000);
        if (position.HasValue && PositionAt >= prior.PositionAt) row.Position = position;
        row.Media = JsonSerializer.SerializeToElement(new MediaRanges(watched, active, Math.Max(PositionAt, prior.PositionAt)),
            JsonSerializerOptions.Web);
    }
}
