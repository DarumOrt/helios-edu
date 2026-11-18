using System.Text.Json;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Audit;

public sealed class Branding
{
    public string TenantId { get; set; } = "";
    public string? Subtitle { get; set; }
    public string? LoginText { get; set; }
    public string? FooterText { get; set; }
    public int? LogoScale { get; set; }
    public int? MenuLogoScale { get; set; }
    public bool? UseLogo { get; set; }
    public byte[]? DarkLogo { get; set; }
    public string? DarkLogoType { get; set; }
    public Guid? DarkLogoVersion { get; set; }
    public byte[]? Logo { get; set; }
    public string? LogoType { get; set; }
    public Guid? LogoVersion { get; set; }
}

public sealed record BrandingInfo(string? Subtitle, string? LoginText, string? FooterText, Guid? LogoVersion,
    Guid? DarkLogoVersion, bool? UseLogo, int? LogoScale, int? MenuLogoScale)
{
    public static BrandingInfo From(Branding? branding) =>
        new(branding?.Subtitle, branding?.LoginText, branding?.FooterText, branding?.LogoVersion, branding?.DarkLogoVersion, branding?.UseLogo, branding?.LogoScale, branding?.MenuLogoScale);
}

public static class BrandingEndpoints
{
    private const int LogoLimit = 512 * 1024;
    private static readonly Dictionary<string, (string Label, int Limit)> TextFields = new()
    {
        ["subtitle"] = ("Подпись под HeliosEDU", 32),
        ["loginText"] = ("Текст приветствия на входе", 200),
        ["footerText"] = ("Подпись внизу страницы входа", 120),
    };

    public static void MapBrandingEndpoints(this WebApplication app)
    {
        app.MapGet("/api/branding", async (HttpContext http, LearningDbContext db) =>
        {
            var tenant = Tenant(http);
            return Results.Ok(await db.Branding.Where(b => b.TenantId == tenant)
                .Select(b => new BrandingInfo(b.Subtitle, b.LoginText, b.FooterText, b.LogoVersion, b.DarkLogoVersion, b.UseLogo, b.LogoScale, b.MenuLogoScale))
                .SingleOrDefaultAsync(http.RequestAborted) ?? BrandingInfo.From(null));
        }).Produces<BrandingInfo>();
        app.MapGet("/api/branding/logo", async (HttpContext http, LearningDbContext db, string? theme) =>
        {
            var branding = await db.Branding.AsNoTracking().SingleOrDefaultAsync(b => b.TenantId == Tenant(http), http.RequestAborted);
            var dark = theme == "dark";
            var logo = dark ? branding?.DarkLogo : branding?.Logo;
            if (logo == null) return Results.NotFound();
            http.Response.Headers["X-Content-Type-Options"] = "nosniff";
            return Results.File(logo, dark ? branding?.DarkLogoType : branding?.LogoType);
        });
        app.MapPut("/api/branding", UpdateAsync).RequireAuthorization(AccessRules.ManageSystem)
            .AddEndpointFilter<ManagementWriteFilter>().Produces<BrandingInfo>();
    }

    private static string Tenant(HttpContext http) => (http.Items[typeof(Account)] as Account)?.TenantId ?? "pspu";

    private static async Task<IResult> UpdateAsync(HttpContext http, LearningDbContext db)
    {
        if (http.Request.ContentLength > 1_420_000) return Fail(413, "Слишком большой файл");
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input == null) return Fail(400, "Некорректный запрос");
        var errors = new Dictionary<string, string>();
        var logos = new Dictionary<string, (byte[]? Bytes, string? Type)>();
        foreach (var key in input.Keys)
        {
            if (key is "logo" or "darkLogo")
            {
                if (input.Value(key)?.ValueKind == JsonValueKind.Null)
                {
                    logos[key] = (null, null);
                    continue;
                }
                var encoded = input.Text(key);
                if (encoded.Length <= (LogoLimit + 2) / 3 * 4)
                {
                    var buffer = new byte[LogoLimit];
                    if (Convert.TryFromBase64String(encoded, buffer, out var size) &&
                        ImageType(buffer.AsSpan(0, size)) is { } type)
                    {
                        logos[key] = (buffer[..size], type);
                        continue;
                    }
                }
                errors[key] = "Выберите PNG, JPEG или WebP до 512 КБ";
            }
            else if (key is "logoScale" or "menuLogoScale")
            {
                if (input.Value(key) is { ValueKind: not JsonValueKind.Null } value &&
                    (value.ValueKind != JsonValueKind.Number || !value.TryGetInt32(out var scale) || scale is < 50 or > 130))
                    errors[key] = "Укажите целое число от 50 до 130";
            }
            else if (key == "useLogo")
            {
                if (input.Value(key)?.ValueKind is not (JsonValueKind.True or JsonValueKind.False or JsonValueKind.Null))
                    errors[key] = "Выберите логотип или текстовую подпись";
            }
            else if (!TextFields.TryGetValue(key, out var field)) errors[key] = "Неизвестная настройка";
            else if (input.Value(key)?.ValueKind is not (JsonValueKind.Null or JsonValueKind.String) ||
                input.Text(key).Length > field.Limit || input.Text(key).Any(char.IsControl))
                errors[key] = $"Введите текст в одну строку (до {field.Limit} знаков)";
        }
        if (errors.Count > 0) return Invalid(errors);

        var tenant = Tenant(http);
        var ct = http.RequestAborted;
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Branding" ("TenantId") VALUES ({tenant}) ON CONFLICT DO NOTHING
            """, ct);
        var current = await db.Branding.FromSqlInterpolated($"""
            SELECT * FROM "Branding" WHERE "TenantId" = {tenant} FOR UPDATE
            """).SingleAsync(ct);
        string? Text(string key, string? fallback) => input.Has(key) ? input.OptionalText(key) : fallback;
        var subtitle = Text("subtitle", current.Subtitle);
        var loginText = Text("loginText", current.LoginText);
        var footerText = Text("footerText", current.FooterText);
        var changes = AuditLog.Diff(
            (TextFields["subtitle"].Label, current.Subtitle, subtitle),
            (TextFields["loginText"].Label, current.LoginText, loginText),
            (TextFields["footerText"].Label, current.FooterText, footerText));
        if (input.Has("useLogo"))
        {
            var mode = input.Value("useLogo")!.Value;
            bool? useLogo = mode.ValueKind == JsonValueKind.Null ? null : mode.GetBoolean();
            if (useLogo != current.UseLogo)
            {
                static string Label(bool? value) => value switch
                {
                    true => "Логотип", false => "Текстовая подпись", null => "Исходное оформление"
                };
                changes.Add(new AuditChange("Оформление под названием сайта", Label(current.UseLogo), Label(useLogo)));
                current.UseLogo = useLogo;
            }
        }
        int? UpdateScale(string key, int? previous, string label)
        {
            if (input.Value(key) is not { } value) return previous;
            int? next = value.ValueKind == JsonValueKind.Null ? null : value.GetInt32();
            if (previous != next)
                changes.Add(new AuditChange(label, $"{previous ?? 100}%", $"{next ?? 100}%"));
            return next;
        }
        current.LogoScale = UpdateScale("logoScale", current.LogoScale, "Масштаб логотипа на входе");
        current.MenuLogoScale = UpdateScale("menuLogoScale", current.MenuLogoScale, "Масштаб логотипа в меню");
        foreach (var (key, (bytes, type)) in logos)
        {
            var dark = key == "darkLogo";
            var before = dark ? current.DarkLogo : current.Logo;
            if ((before ?? []).AsSpan().SequenceEqual(bytes ?? [])) continue;
            changes.Add(new AuditChange(dark ? "Логотип для тёмной темы" : "Логотип для светлой темы",
                before == null ? "Нет файла" : "Загружен", bytes == null ? "Удалён" : "Загружен новый"));
            Guid? version = bytes == null ? null : Guid.NewGuid();
            if (dark)
            {
                current.DarkLogo = bytes;
                current.DarkLogoType = type;
                current.DarkLogoVersion = version;
            }
            else
            {
                current.Logo = bytes;
                current.LogoType = type;
                current.LogoVersion = version;
            }
        }
        if (changes.Count > 0)
        {
            current.Subtitle = subtitle;
            current.LoginText = loginText;
            current.FooterText = footerText;
            AuditLog.Write(db, http, "settings.updated", "settings", null, "Оформление организации", changes);
            await db.SaveChangesAsync(ct);
        }
        return Results.Ok(BrandingInfo.From(current));
    }

    private static string? ImageType(ReadOnlySpan<byte> bytes)
    {
        if (bytes.StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) &&
            bytes.Length >= 33 && bytes[12..].StartsWith("IHDR"u8)) return "image/png";
        if (bytes.StartsWith(new byte[] { 255, 216, 255 }) && bytes.EndsWith(new byte[] { 255, 217 }))
            return "image/jpeg";
        if (bytes.Length >= 20 && bytes.StartsWith("RIFF"u8) && bytes[8..].StartsWith("WEBP"u8))
            return "image/webp";
        return null;
    }
}
