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
    public byte[]? Logo { get; set; }
    public string? LogoType { get; set; }
    public Guid? LogoVersion { get; set; }
}

public sealed record BrandingInfo(string? Subtitle, string? LoginText, string? FooterText, Guid? LogoVersion)
{
    public static BrandingInfo From(Branding? branding) =>
        new(branding?.Subtitle, branding?.LoginText, branding?.FooterText, branding?.LogoVersion);
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
                .Select(b => new BrandingInfo(b.Subtitle, b.LoginText, b.FooterText, b.LogoVersion))
                .SingleOrDefaultAsync(http.RequestAborted) ?? BrandingInfo.From(null));
        }).Produces<BrandingInfo>();
        app.MapGet("/api/branding/logo", async (HttpContext http, LearningDbContext db) =>
        {
            var branding = await db.Branding.AsNoTracking().SingleOrDefaultAsync(b => b.TenantId == Tenant(http), http.RequestAborted);
            if (branding?.Logo is not { } logo) return Results.NotFound();
            http.Response.Headers["X-Content-Type-Options"] = "nosniff";
            return Results.File(logo, branding.LogoType);
        });
        app.MapPut("/api/branding", UpdateAsync).RequireAuthorization(AccessRules.ManageSystem)
            .AddEndpointFilter<ManagementWriteFilter>().Produces<BrandingInfo>();
    }

    private static string Tenant(HttpContext http) => (http.Items[typeof(Account)] as Account)?.TenantId ?? "pspu";

    private static async Task<IResult> UpdateAsync(HttpContext http, LearningDbContext db)
    {
        if (http.Request.ContentLength > 720_000) return Fail(413, "Слишком большой файл");
        var input = await ManagementInput.ReadAsync(http.Request);
        if (input == null) return Fail(400, "Некорректный запрос");
        var errors = new Dictionary<string, string>();
        byte[]? logo = null;
        string? logoType = null;
        foreach (var key in input.Keys)
        {
            if (key == "logo")
            {
                if (input.Value(key)?.ValueKind == JsonValueKind.Null) continue;
                var encoded = input.Text(key);
                if (encoded.Length <= (LogoLimit + 2) / 3 * 4)
                {
                    var buffer = new byte[LogoLimit];
                    if (Convert.TryFromBase64String(encoded, buffer, out var size))
                    {
                        logo = buffer[..size];
                        logoType = ImageType(logo);
                    }
                }
                if (logoType == null) errors[key] = "Выберите PNG, JPEG или WebP до 512 КБ";
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
        if (input.Has("logo") && !(current.Logo ?? []).AsSpan().SequenceEqual(logo ?? []))
        {
            changes.Add(new AuditChange("Логотип организации", current.Logo == null ? "Исходный" : "Загружен",
                logo == null ? "Исходный" : "Загружен новый"));
            current.Logo = logo;
            current.LogoType = logoType;
            current.LogoVersion = logo == null ? null : Guid.NewGuid();
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
