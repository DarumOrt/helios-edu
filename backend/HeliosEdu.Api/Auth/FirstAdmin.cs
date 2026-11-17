using HeliosEdu.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Auth;

/// <summary>
/// Первый администратор на чистой базе (без демо-данных): Admin__Email и Admin__Password из окружения.
/// Создаётся, только пока в базе нет ни одного администратора; пароль временный — при входе попросим сменить.
/// </summary>
public static class FirstAdmin
{
    public static async Task EnsureAsync(LearningDbContext db, IConfiguration configuration, ILogger logger,
        CancellationToken cancellationToken)
    {
        var email = configuration["Admin:Email"]?.Trim() ?? "";
        var password = configuration["Admin:Password"] ?? "";
        if (email.Length == 0 && password.Length == 0) return;
        if (await db.Accounts.AnyAsync(account => account.Role == "admin", cancellationToken)) return;

        if (email.Length > 254 || !AuthEndpoints.LooksLikeEmail(email))
            throw new InvalidOperationException("Admin__Email: укажите почту первого администратора.");
        if (AuthEndpoints.PasswordError(password) is { } error)
            throw new InvalidOperationException($"Admin__Password: {error}");
        var normalized = email.ToUpperInvariant();
        if (await db.Accounts.AnyAsync(account => account.NormalizedEmail == normalized, cancellationToken))
            throw new InvalidOperationException("Admin__Email: эта почта уже занята пользователем без прав администратора.");

        var name = configuration["Admin:Name"]?.Trim();
        var admin = new Account
        {
            Id = $"u-{Guid.NewGuid():N}", Name = string.IsNullOrEmpty(name) ? "Администратор" : name, Email = email,
            NormalizedEmail = normalized, Role = "admin", Status = "active", MustChangePassword = true,
        };
        admin.PasswordHash = new PasswordHasher<Account>().HashPassword(admin, password);
        db.Accounts.Add(admin);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Создан первый администратор {Email}.", email);
    }
}
