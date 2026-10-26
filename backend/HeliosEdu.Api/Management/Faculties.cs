using System.Text.RegularExpressions;

namespace HeliosEdu.Api.Management;

// Факультеты ПГГПУ — тот же список, что src/shared/lib/faculties.ts.
public static partial class Faculties
{
    public static readonly string[] Codes =
        ["ИНЭК", "МФ", "ФизФ", "ЕНФ", "ФФ", "ИстФ", "ИнЯз", "ПсФ", "ПиСПО", "ПиМНО", "ППД", "МузФ", "ФФК"];

    [GeneratedRegex(@"^(\d{4})/(\d{4})$")]
    private static partial Regex AcademicYearPattern();

    public static bool IsAcademicYear(string value)
    {
        var match = AcademicYearPattern().Match(value);
        return match.Success && int.Parse(match.Groups[2].Value) == int.Parse(match.Groups[1].Value) + 1;
    }
}
