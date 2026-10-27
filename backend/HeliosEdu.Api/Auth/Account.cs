namespace HeliosEdu.Api.Auth;

public sealed class Account
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string NormalizedEmail { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "student";
    public string Status { get; set; } = "active";
    public string TenantId { get; set; } = "pspu";
    public string? Faculty { get; set; }
    public string? Group { get; set; }
}

public sealed class LoginSession
{
    public string TokenHash { get; set; } = "";
    public string AccountId { get; set; } = "";
    public Account Account { get; set; } = null!;
    public DateTimeOffset ExpiresAt { get; set; }
}

/// <summary>Одногруппник: без почты и роли — контакты видит только управление (/api/users).</summary>
public sealed record ClassmateInfo(string Id, string Name, string? Group);

public sealed record UserInfo(string Id, string Name, string Email, string Role,
    string TenantId, string? Faculty, string? Group, string Status)
{
    public static UserInfo From(Account account) => new(account.Id, account.Name, account.Email,
        account.Role, account.TenantId, account.Faculty, account.Group, account.Status);
}
