using HeliosEdu.Api.Audit;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Mail;

public sealed record MailSettingsInput(string Host, int Port, string Security, string Username, string? Password,
    string FromEmail, string FromName, bool UserCreated, bool Invitation, bool CourseAssigned, bool GroupAdded, bool CoursePublished);
public sealed record Audience(string[]? UserIds, string[]? CohortIds, bool All = false);
public sealed record CampaignInput(string RequestId, Audience Audience, string Subject, string Text, string? Html, bool ConfirmAll = false);
public sealed record AudienceInfo(int Count);
public sealed record MailCheckInput(string? Email);
public sealed record MailCheckResult(string State, string Message);

public static class MailEndpoints
{
    private static Account Actor(HttpContext c) => (Account)c.Items[typeof(Account)]!;
    public static void MapMailEndpoints(this WebApplication app)
    {
        var routes = app.MapGroup("/api/mail").RequireAuthorization(AccessRules.ManageSystem)
            .AddEndpointFilter<ManagementWriteFilter>();
        routes.MapGet("/settings", async (LearningDbContext db, HttpContext c) =>
            MailService.Info(await MailService.Settings(db, Actor(c).TenantId, c.RequestAborted) ?? new MailSettings()))
            .Produces<MailSettingsInfo>();
        routes.MapPut("/settings", async Task<IResult> (MailSettingsInput input, LearningDbContext db, MailService mail,
            HttpContext c, IConfiguration config) =>
        {
            if (input.Invitation && !mail.InvitationsConfigured) return Fail(400, "Для приглашений задайте Mail__PublicUrl — HTTPS-адрес платформы");
            if (string.IsNullOrWhiteSpace(input.Host) || input.Host.Length > 253 || input.Host.Any(char.IsWhiteSpace) ||
                input.Port is < 1 or > 65535 || input.Security is not ("tls" or "starttls" or "none") ||
                (input.Security == "none" && !config.GetValue<bool>("Mail:AllowInsecure")) ||
                !MailService.EmailValid(input.FromEmail) || input.FromName is null || input.FromName.Length > 100 ||
                input.FromName.Any(ch => ch is '\r' or '\n') || input.Username is null || input.Username.Length > 254 || input.Password?.Length > 1000)
                return Fail(400, "Проверьте SMTP: адрес, порт, шифрование и отправителя");
            var s = await MailService.Settings(db, Actor(c).TenantId, c.RequestAborted);
            if (s is null) { s = new MailSettings { TenantId = Actor(c).TenantId }; db.Add(s); }
            if (!string.IsNullOrEmpty(input.Password)) s.Secret = mail.Protect(input.Password);
            if (input.Username.Length > 0 && s.Secret.Length == 0) return Fail(400, "Укажите пароль SMTP");
            s.Host = input.Host.Trim(); s.Port = input.Port; s.Security = input.Security; s.Username = input.Username.Trim();
            s.FromEmail = input.FromEmail; s.FromName = input.FromName; s.UserCreated = input.UserCreated;
            s.Invitation = input.Invitation; s.CourseAssigned = input.CourseAssigned; s.GroupAdded = input.GroupAdded;
            s.CoursePublished = input.CoursePublished; s.ConnectionState = null; s.CheckedAt = null;
            AuditLog.Write(db, c, "mail.settings", "system", null, "Настройки SMTP изменены");
            await db.SaveChangesAsync(c.RequestAborted);
            return Results.Ok(MailService.Info(s));
        }).Produces<MailSettingsInfo>();
        routes.MapPost("/check", Check).RequireRateLimiting("mail").Produces<MailCheckResult>();
        routes.MapPost("/audience", async Task<IResult> (Audience input, LearningDbContext db, HttpContext c) =>
        {
            var users = await Recipients(input, db, Actor(c).TenantId, c.RequestAborted);
            return users is null ? Fail(400, "Выберите существующих пользователей и группы") : Results.Ok(new AudienceInfo(users.Count));
        }).Produces<AudienceInfo>();
        routes.MapPost("/campaigns", Create).RequireRateLimiting("mail").Produces<CampaignInfo>();
        routes.MapGet("/campaigns", async (LearningDbContext db, HttpContext c) =>
        {
            var campaigns = await db.Set<MailCampaign>().Where(x => x.TenantId == Actor(c).TenantId)
                .OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync(c.RequestAborted);
            var result = new List<CampaignInfo>();
            foreach (var campaign in campaigns) result.Add(await Info(db, campaign, c.RequestAborted));
            return result;
        }).Produces<CampaignInfo[]>();
        routes.MapGet("/campaigns/{id}", async Task<IResult> (string id, LearningDbContext db, HttpContext c) =>
            !await db.Set<MailCampaign>().AnyAsync(x => x.Id == id && x.TenantId == Actor(c).TenantId, c.RequestAborted)
                ? Fail(404, "not found") : Results.Ok(await db.Set<MailRecipient>().Where(r => r.CampaignId == id)
                    .OrderBy(r => r.Email).Select(r => new RecipientInfo(r.Email, r.Status, r.Attempts, r.Error)).ToListAsync(c.RequestAborted)))
            .Produces<RecipientInfo[]>();
        routes.MapPost("/invite/{id}", async Task<IResult> (string id, LearningDbContext db, MailService mail, HttpContext c) =>
        {
            var tenant = Actor(c).TenantId;
            var user = await db.Accounts.FromSqlInterpolated($"SELECT * FROM \"Accounts\" WHERE \"Id\" = {id} AND \"TenantId\" = {tenant} AND \"Status\" = 'active' FOR UPDATE").SingleOrDefaultAsync(c.RequestAborted);
            if (user is null) return Fail(404, "not found");
            if (!mail.InvitationsConfigured || !await Ready(db, Actor(c).TenantId, c.RequestAborted)) return Fail(400, "Сначала настройте SMTP и публичный адрес платформы Mail__PublicUrl");
            var active = await db.Set<AccountActivation>().Where(a => a.AccountId == id && a.ExpiresAt > DateTimeOffset.UtcNow)
                .OrderByDescending(a => a.ExpiresAt).FirstOrDefaultAsync(c.RequestAborted);
            if (active is not null)
            {
                var since = active.ExpiresAt.AddDays(-2).AddSeconds(-2);
                if (await db.Set<MailRecipient>().AnyAsync(r => r.UserId == id && r.Status != "failed" &&
                    db.Set<MailCampaign>().Any(m => m.Id == r.CampaignId && m.Fingerprint == "invitation" && m.CreatedAt >= since), c.RequestAborted))
                    return Fail(409, "Приглашение уже выслано и действует 48 часов");
                await db.Set<AccountActivation>().Where(a => a.AccountId == id).ExecuteDeleteAsync(c.RequestAborted);
            }
            await mail.Invite(db, user, $"invite:{Guid.NewGuid():N}", c.RequestAborted);
            AuditLog.Write(db, c, "mail.invitation", "user", id, "Приглашение поставлено в очередь");
            await db.SaveChangesAsync(c.RequestAborted);
            return Results.Ok(new MailCheckResult("queued", "Приглашение в очереди"));
        }).RequireRateLimiting("mail").Produces<MailCheckResult>();
    }

    public static Task<bool> Ready(LearningDbContext db, string tenant, CancellationToken ct) =>
        db.Set<MailSettings>().AnyAsync(s => s.TenantId == tenant && s.Host != "", ct);

    public static async Task<List<Account>?> Recipients(Audience? audience, LearningDbContext db, string tenant, CancellationToken ct)
    {
        if (audience is null) return null;
        var ids = audience.UserIds?.Distinct().ToArray() ?? [];
        var groups = audience.CohortIds?.Distinct().ToArray() ?? [];
        if (ids.Length > 5000 || groups.Length > 200 ||
            await db.Accounts.CountAsync(u => ids.Contains(u.Id) && u.TenantId == tenant && u.Status == "active", ct) != ids.Length ||
            await db.Cohorts.CountAsync(g => groups.Contains(g.Id) && g.TenantId == tenant, ct) != groups.Length) return null;
        return await db.Accounts.Where(u => u.TenantId == tenant && u.Status == "active" &&
            (audience.All || ids.Contains(u.Id) || db.Cohorts.Any(g => groups.Contains(g.Id) && g.Name == u.Group && g.TenantId == tenant)))
            .OrderBy(u => u.Id).Take(10001).ToListAsync(ct);
    }

    private static async Task<IResult> Create(CampaignInput input, LearningDbContext db, MailService mail, HttpContext c)
    {
        if (!Guid.TryParse(input.RequestId, out _) || string.IsNullOrWhiteSpace(input.Subject) || input.Subject.Length > 200 ||
            input.Subject.Any(ch => ch is '\r' or '\n') || string.IsNullOrWhiteSpace(input.Text) || input.Text.Length > 50000 || input.Html?.Length > 100000 ||
            input.Audience is null || input.Audience.All && !input.ConfirmAll) return Fail(400, "Проверьте письмо и подтвердите отправку всем пользователям");
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(74982102)", c.RequestAborted);
        var fingerprint = MailService.Fingerprint(input);
        var existing = await db.Set<MailCampaign>().SingleOrDefaultAsync(x => x.TenantId == Actor(c).TenantId && x.RequestId == input.RequestId, c.RequestAborted);
        if (existing is not null) return existing.Fingerprint == fingerprint ? Results.Ok(await Info(db, existing, c.RequestAborted)) : Fail(409, "Этот запрос уже использован для другого письма");
        if (!await Ready(db, Actor(c).TenantId, c.RequestAborted)) return Fail(400, "Сначала настройте SMTP");
        if (await db.Set<MailRecipient>().CountAsync(r => (r.Status == "queued" || r.Status == "sending") &&
            db.Set<MailCampaign>().Any(x => x.Id == r.CampaignId && x.TenantId == Actor(c).TenantId), c.RequestAborted) >= 20000)
            return Fail(429, "В очереди уже 20000 писем. Дождитесь завершения рассылок.");
        var users = await Recipients(input.Audience, db, Actor(c).TenantId, c.RequestAborted);
        if (users is null || users.Count is < 1 or > 10000) return Fail(400, "Выберите от 1 до 10000 получателей");
        var campaign = mail.Enqueue(db, Actor(c).TenantId, input.RequestId, fingerprint, input.Subject.Trim(), new MailBody(input.Text, input.Html), users);
        AuditLog.Write(db, c, "mail.campaign", "mail", campaign.Id, $"Рассылка: {users.Count} получателей");
        await db.SaveChangesAsync(c.RequestAborted);
        return Results.Ok(await Info(db, campaign, c.RequestAborted));
    }

    public static async Task<CampaignInfo> Info(LearningDbContext db, MailCampaign campaign, CancellationToken ct)
    {
        var rows = await db.Set<MailRecipient>().Where(r => r.CampaignId == campaign.Id).Select(r => new { r.Status, r.Attempts }).ToListAsync(ct);
        var sent = rows.Count(r => r.Status == "sent"); var failed = rows.Count(r => r.Status == "failed"); var pending = rows.Count - sent - failed;
        var state = pending > 0 ? rows.Any(r => r.Attempts > 0) ? "running" : "queued" : failed == 0 ? "completed" : sent == 0 ? "failed" : "partial";
        return new CampaignInfo(campaign.Id, campaign.Subject, campaign.CreatedAt, state, rows.Count, sent, failed, pending);
    }

    private static async Task<IResult> Check(MailCheckInput input, LearningDbContext db, MailService mail, HttpContext c)
    {
        if (input.Email is not null && !MailService.EmailValid(input.Email)) return Fail(400, "Укажите корректную почту");
        var s = await MailService.Settings(db, Actor(c).TenantId, c.RequestAborted);
        if (s is null) return Fail(400, "Сначала настройте SMTP");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(c.RequestAborted);
        timeout.CancelAfter(TimeSpan.FromSeconds(15));
        try
        {
            using var client = await mail.Connect(s, timeout.Token);
            if (input.Email is not null)
            {
                var campaign = new MailCampaign { Subject = "Проверка SMTP HeliosEDU", Body = mail.Protect(System.Text.Json.JsonSerializer.Serialize(new MailBody("Тестовое письмо HeliosEDU", null), new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))) };
                await mail.Send(client, s, campaign, new MailRecipient { Email = input.Email }, timeout.Token);
            }
            s.ConnectionState = "connected";
        }
        catch (Exception e) when (e is not OperationCanceledException || !c.RequestAborted.IsCancellationRequested) { s.ConnectionState = "error"; }
        s.CheckedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(c.RequestAborted);
        return Results.Ok(new MailCheckResult(s.ConnectionState, s.ConnectionState == "connected"
            ? input.Email is null ? "Соединение и авторизация проверены" : "SMTP принял тестовое письмо; доставка в ящик не подтверждена"
            : "Не удалось подключиться или отправить письмо. Проверьте настройки SMTP."));
    }
}
