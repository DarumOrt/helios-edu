using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace HeliosEdu.Api.Courses;

// Срок сдачи хранится как timestamptz, а в JSON остаётся прежним: «2026-11-12T00:00:00.000Z» (UTC, миллисекунды) —
// так его отдавал API, когда срок был строкой; так же пишет toISOString() в браузере.
public sealed class UtcIsoDateConverter : JsonConverter<DateTimeOffset>
{
    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        DateTimeOffset.Parse(reader.GetString()!, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal);

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture));
}
