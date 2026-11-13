using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using MailKit.Net.Smtp;
using MailKit;
using MailKit.Security;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using MimeKit;

namespace HeliosEdu.Api.Mail;

public sealed class MailService(IDataProtectionProvider protection, IConfiguration config)
{
    private readonly IDataProtector protector = protection.CreateProtector("helios-mail-v1");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public string Protect(string value) => protector.Protect(value);
    public string Unprotect(string value) => protector.Unprotect(value);
    public bool InvitationsConfigured => Uri.TryCreate(config["Mail:PublicUrl"], UriKind.Absolute, out var uri) &&
        (uri.Scheme == "https" || uri.IsLoopback && uri.Scheme == "http");
    public static string Fingerprint<T>(T value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value, Json))));
    public static MailSettingsInfo Info(MailSettings s) => new(s.Host, s.Port, s.Security, s.Username,
        s.Secret.Length > 0, s.FromEmail, s.FromName, s.UserCreated, s.Invitation, s.CourseAssigned,
        s.GroupAdded, s.CoursePublished, s.ConnectionState, s.CheckedAt);
    public static bool EmailValid(string? email) => email is { Length: > 3 and <= 254 } &&
        !email.Any(char.IsWhiteSpace) && MailboxAddress.TryParse(email, out var mailbox) && mailbox.Address == email && email.Contains('.');
    public static Task<MailSettings?> Settings(LearningDbContext db, string tenant, CancellationToken ct) =>
        db.Set<MailSettings>().SingleOrDefaultAsync(s => s.TenantId == tenant, ct);

    public async Task<SmtpClient> Connect(MailSettings s, CancellationToken ct)
    {
        var client = new SmtpClient { Timeout = 10000 };
        try
        {
            var security = s.Security switch { "tls" => SecureSocketOptions.SslOnConnect,
                "none" when config.GetValue<bool>("Mail:AllowInsecure") => SecureSocketOptions.None,
                _ => SecureSocketOptions.StartTls };
            await client.ConnectAsync(s.Host, s.Port, security, ct);
            if (s.Username.Length > 0) await client.AuthenticateAsync(s.Username, Unprotect(s.Secret), ct);
            return client;
        }
        catch { client.Dispose(); throw; }
    }

    public async Task Send(SmtpClient client, MailSettings s, MailCampaign campaign, MailRecipient recipient, CancellationToken ct)
    {
        var body = JsonSerializer.Deserialize<MailBody>(Unprotect(campaign.Body), Json)!;
        var message = new MimeMessage { Subject = campaign.Subject,
            MessageId = $"{recipient.Id}@helios.invalid", Date = DateTimeOffset.UtcNow };
        message.From.Add(new MailboxAddress(s.FromName, s.FromEmail));
        message.To.Add(MailboxAddress.Parse(recipient.Email));
        message.Body = new BodyBuilder { TextBody = body.Text, HtmlBody = body.Html }.ToMessageBody();
        await client.SendAsync(message, ct);
    }

    public MailCampaign Enqueue(LearningDbContext db, string tenant, string requestId, string fingerprint,
        string subject, MailBody body, IEnumerable<Account> users)
    {
        var campaign = new MailCampaign { TenantId = tenant, RequestId = requestId, Fingerprint = fingerprint,
            Subject = subject, Body = Protect(JsonSerializer.Serialize(body, Json)) };
        db.Add(campaign);
        db.AddRange(users.Where(u => u.Status == "active").DistinctBy(u => u.NormalizedEmail)
            .Select(u => new MailRecipient { CampaignId = campaign.Id, UserId = u.Id, Email = u.Email.ToLowerInvariant() }));
        return campaign;
    }

    public async Task Invite(LearningDbContext db, Account user, string operation, CancellationToken ct)
    {
        var baseUrl = config["Mail:PublicUrl"];
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "https" && !(uri.IsLoopback && uri.Scheme == "http")))
            throw new InvalidOperationException("Задайте Mail__PublicUrl: HTTPS-адрес платформы.");
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        db.Add(new AccountActivation { TokenHash = SessionAuthentication.Hash(token), AccountId = user.Id,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(2) });
        var link = $"{baseUrl!.TrimEnd('/')}/activate#token={token}";
        Enqueue(db, user.TenantId, operation, "invitation", "Приглашение в HeliosEDU",
            new MailBody($"Здравствуйте, {user.Name}! Установите пароль по ссылке (действует 48 часов): {link}",
                $"<p>Здравствуйте, {WebUtility.HtmlEncode(user.Name)}!</p><p><a href=\"{WebUtility.HtmlEncode(link)}\">Установить пароль</a> (48 часов)</p>"), [user]);
        await Task.CompletedTask;
    }
}
