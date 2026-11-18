namespace HeliosEdu.Api.Auth;

public sealed class Account
{
    public const string Pending = "pending";
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string NormalizedEmail { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "student";
    public string Status { get; set; } = "active";
    public string TenantId { get; set; } = "pspu";
    public string? Faculty { get; set; }
    public string[]? OrganizerFaculties { get; set; }
    public string? Group { get; set; }
    public DateTimeOffset? CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    /// <summary>после выдачи временного пароля (создание, сброс) — при входе попросить сменить его на свой</summary>
    public bool MustChangePassword { get; set; }
}

public sealed class LoginSession
{
    public string TokenHash { get; set; } = "";
    public string AccountId { get; set; } = "";
    public Account Account { get; set; } = null!;
    public Guid? PreviewId { get; set; }
    public string? PreviewRole { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}

/// <summary>Одногруппник: без почты и роли — контакты видит только управление (/api/users).</summary>
public sealed record ClassmateInfo(string Id, string Name, string? Group);

/// <summary>Сброс пароля: POST /api/users/{id}/password-reset — временный пароль показывается один раз.</summary>
public sealed record PasswordResetResult(UserInfo User, string TemporaryPassword);

public sealed record UserInfo(string Id, string Name, string Email, string Role,
    string TenantId, string? Faculty, string? Group, string Status, bool? MustChangePassword, string[]? OrganizerFaculties, string? PreviewContext = null)
{
    public static UserInfo From(Account account) => new(account.Id, account.Name, account.Email,
        account.Role, account.TenantId, account.Faculty, account.Group, account.Status,
        account.MustChangePassword ? true : null, account.Role == "organizer" ? account.OrganizerFaculties : null);
}
