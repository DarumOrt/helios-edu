using System.Text.RegularExpressions;

namespace HeliosEdu.Api.Management;

public sealed class Faculty
{
    public string TenantId { get; set; } = "";
    public string Code { get; set; } = "";
    public string NormalizedCode { get; set; } = "";
    public string Name { get; set; } = "";
    public bool Archived { get; set; }
}

public static partial class Faculties
{
    [GeneratedRegex(@"^(\d{4})/(\d{4})$")]
    private static partial Regex AcademicYearPattern();

    public static bool IsAcademicYear(string value)
    {
        var match = AcademicYearPattern().Match(value);
        return match.Success && int.Parse(match.Groups[2].Value) == int.Parse(match.Groups[1].Value) + 1;
    }
}
