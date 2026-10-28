using System.Text.Json;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Audit;

// Настройки системы и журнал действий (docs/backend/p3-p4-notes.md). Те же пути и ответы, что у моков Next.
public static class AuditEndpoints
{
    private const string DefaultTenant = "pspu";
    private static readonly Dictionary<string, string> SettingLabels = new()
    {
        ["allowRegistration"] = "Открытая регистрация студентов",
        ["announcementsEnabled"] = "Объявления преподавателей",
    };

    public static void MapAuditEndpoints(this WebApplication app)
    {
        // настройки читают все, даже без входа: страница регистрации решает, показывать ли форму
        app.MapGet("/api/settings", async (HttpContext context, LearningDbContext db, IConfiguration configuration) =>
            Results.Ok(SettingsInfo.From(await SettingsAsync(db, Tenant(context), configuration, context.RequestAborted))))
            .Produces<SettingsInfo>();
        app.MapPut("/api/settings", UpdateSettingsAsync).RequireAuthorization(AccessRules.ManageSystem)
            .AddEndpointFilter<ManagementWriteFilter>().Produces<SettingsInfo>();
        app.MapGet("/api/audit", ListAsync).RequireAuthorization(AccessRules.ManageSystem).Produces<AuditPage>();
    }

    private static string Tenant(HttpContext context) =>
        (context.Items[typeof(Account)] as Account)?.TenantId ?? DefaultTenant;

    /// <summary>
    /// Настройки организации; при первом обращении — строка со значениями по умолчанию
    /// (регистрация — из Auth:AllowRegistration, как было до переноса настроек в базу).
    /// </summary>
    public static async Task<SystemSettings> SettingsAsync(LearningDbContext db, string tenantId, IConfiguration configuration,
        CancellationToken token)
    {
        var settings = await db.Settings.SingleOrDefaultAsync(item => item.TenantId == tenantId, token);
        if (settings is not null) return settings;
        settings = new SystemSettings
        {
            TenantId = tenantId, AllowRegistration = configuration.GetValue("Auth:AllowRegistration", true),
            AnnouncementsEnabled = true, UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.Settings.Add(settings);
        try
        {
            await db.SaveChangesAsync(token);
        }
        catch (DbUpdateException)
        {
            // два первых запроса одновременно: строку уже создал другой
            db.Entry(settings).State = EntityState.Detached;
            settings = await db.Settings.SingleAsync(item => item.TenantId == tenantId, token);
        }
        return settings;
    }

    /// <summary>PUT { allowRegistration?, announcementsEnabled? } — неизвестные поля и не да/нет — 400.</summary>
    private static async Task<IResult> UpdateSettingsAsync(HttpContext context, LearningDbContext db, IConfiguration configuration)
    {
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var fields = new Dictionary<string, string>();
        foreach (var key in input.Keys)
            if (!SettingLabels.ContainsKey(key)) fields[key] = "Неизвестная настройка";
            else if (input.Value(key)?.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
                fields[key] = "Ожидается да или нет";
        if (fields.Count > 0) return Invalid(fields);

        var settings = await SettingsAsync(db, Tenant(context), configuration, context.RequestAborted);
        bool Flag(string key, bool current) => input.Has(key) ? input.Value(key)!.Value.GetBoolean() : current;
        var registration = Flag("allowRegistration", settings.AllowRegistration);
        var announcements = Flag("announcementsEnabled", settings.AnnouncementsEnabled);
        var changes = AuditLog.Diff(
            (SettingLabels["allowRegistration"], AuditLog.YesNo(settings.AllowRegistration), AuditLog.YesNo(registration)),
            (SettingLabels["announcementsEnabled"], AuditLog.YesNo(settings.AnnouncementsEnabled), AuditLog.YesNo(announcements)));
        if (changes.Count > 0)
        {
            settings.AllowRegistration = registration;
            settings.AnnouncementsEnabled = announcements;
            settings.UpdatedAt = DateTimeOffset.UtcNow;
            AuditLog.Write(db, context, "settings.updated", "settings", null, "Настройки системы", changes);
            await db.SaveChangesAsync(context.RequestAborted);
        }
        return Results.Ok(SettingsInfo.From(settings));
    }

    /// <summary>
    /// GET ?from=&amp;to=&amp;category=&amp;role=&amp;q=&amp;cursor=&amp;limit= — журнал новее → старее, по 50 записей.
    /// from/to — даты (включительно), q — поиск по тому, кто, что и над чем.
    /// </summary>
    private static async Task<IResult> ListAsync(HttpContext context, LearningDbContext db, string? from, string? to,
        string? category, string? role, string? q, long? cursor, int? limit)
    {
        var tenant = Tenant(context);
        var query = db.AuditLog.AsNoTracking().Where(item => item.TenantId == tenant);
        if (DateOnly.TryParse(from, out var fromDate))
            query = query.Where(item => item.At >= new DateTimeOffset(fromDate.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        if (DateOnly.TryParse(to, out var toDate))
            query = query.Where(item => item.At < new DateTimeOffset(toDate.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        if (!string.IsNullOrEmpty(category)) query = query.Where(item => item.Category == category);
        if (!string.IsNullOrEmpty(role)) query = query.Where(item => item.ActorRole == role);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = $"%{q.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
            var actions = AuditLog.Actions.Where(item => item.Value.Text.Contains(q.Trim(), StringComparison.OrdinalIgnoreCase))
                .Select(item => item.Key).ToList();
            query = query.Where(item => EF.Functions.ILike(item.ActorName, pattern) ||
                EF.Functions.ILike(item.TargetName, pattern) || actions.Contains(item.Action));
        }
        if (cursor is { } before) query = query.Where(item => item.Id < before);
        var size = Math.Clamp(limit ?? 50, 1, 200);
        var rows = await query.OrderByDescending(item => item.Id).Take(size + 1).ToListAsync(context.RequestAborted);
        var page = rows.Take(size).Select(item => new AuditEntryInfo(item.Id, item.At, item.ActorName, item.ActorRole,
            item.Action, AuditLog.Text(item.Action), item.Category, item.TargetType, item.TargetId, item.TargetName,
            item.Changes)).ToList();
        return Results.Ok(new AuditPage(page, rows.Count > size ? page[^1].Id : null));
    }
}
