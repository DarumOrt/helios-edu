using HeliosEdu.Api.Auth;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Mail;

public sealed class MailSettings
{
    public string TenantId { get; set; } = "";
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string Security { get; set; } = "starttls";
    public string Username { get; set; } = "";
    public string Secret { get; set; } = "";
    public string FromEmail { get; set; } = "";
    public string FromName { get; set; } = "HeliosEDU";
    public bool UserCreated { get; set; }
    public bool Invitation { get; set; } = true;
    public bool CourseAssigned { get; set; }
    public bool GroupAdded { get; set; }
    public bool CoursePublished { get; set; }
    public string? ConnectionState { get; set; }
    public DateTimeOffset? CheckedAt { get; set; }
}

public sealed class MailCampaign
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string TenantId { get; set; } = "";
    public string RequestId { get; set; } = "";
    public string Fingerprint { get; set; } = "";
    public string Subject { get; set; } = "";
    // Тела, содержащие одноразовую ссылку, зашифрованы тем же ключом, что SMTP-пароль.
    public string Body { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class MailRecipient
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string CampaignId { get; set; } = "";
    public string UserId { get; set; } = "";
    public string Email { get; set; } = "";
    public string Status { get; set; } = "queued";
    public int Attempts { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; } = DateTimeOffset.UtcNow;
    public string? Error { get; set; }
}

public sealed class AccountActivation
{
    public string TokenHash { get; set; } = "";
    public string AccountId { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
}

public sealed class UserImport
{
    public string TenantId { get; set; } = "";
    public string RequestId { get; set; } = "";
    public string Fingerprint { get; set; } = "";
    public string Report { get; set; } = "";
}

public sealed record MailBody(string Text, string? Html);
public sealed record MailSettingsInfo(string Host, int Port, string Security, string Username, bool HasPassword,
    string FromEmail, string FromName, bool UserCreated, bool Invitation, bool CourseAssigned, bool GroupAdded,
    bool CoursePublished, string? ConnectionState, DateTimeOffset? CheckedAt);
public sealed record CampaignInfo(string Id, string Subject, DateTimeOffset CreatedAt, string Status,
    int Total, int Sent, int Failed, int Pending);
public sealed record RecipientInfo(string Email, string Status, int Attempts, string? Error);

public static class MailModelConfiguration
{
    public static void ConfigureMail(this ModelBuilder model)
    {
        model.Entity<MailSettings>().HasKey(x => x.TenantId);
        model.Entity<UserImport>().HasKey(x => new { x.TenantId, x.RequestId });
        model.Entity<MailCampaign>().HasIndex(x => new { x.TenantId, x.RequestId }).IsUnique();
        model.Entity<MailRecipient>().HasIndex(x => new { x.CampaignId, x.Email }).IsUnique();
        model.Entity<MailRecipient>().HasIndex(x => new { x.Status, x.NextAttemptAt });
        model.Entity<MailRecipient>().HasOne<MailCampaign>().WithMany().HasForeignKey(x => x.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);
        model.Entity<AccountActivation>().HasKey(x => x.TokenHash);
        model.Entity<AccountActivation>().HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
