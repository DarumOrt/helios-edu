using System.Security.Cryptography;
using HeliosEdu.Api.Audit;
using HeliosEdu.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Auth;

public static class AuthEndpoints
{
    private static readonly Account DummyAccount = new();
    private static readonly string DummyHash = new PasswordHasher<Account>().HashPassword(DummyAccount, "not-an-account");
    public sealed record LoginRequest(string? Email, string? Password);
    public sealed record PasswordChangeRequest(string? CurrentPassword, string? NewPassword);
    public sealed record RegisterRequest(string? Name, string? Email, string? Password, bool? Consent);
    private const int PasswordMin = 8;

    public static void MapAuthEndpoints(this WebApplication app)
    {
        var auth = app.MapGroup("/api/auth");
        // Браузер с другого сайта не может добавить заголовок без CORS preflight.
        auth.AddEndpointFilter(async (context, next) =>
        {
            var request = context.HttpContext.Request;
            if (HttpMethods.IsPost(request.Method) && request.Headers["X-Helios-Client"] != "web")
                return Results.StatusCode(403);
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return await next(context);
        });

        auth.MapPost("/login", async (LoginRequest input, LearningDbContext db,
            IPasswordHasher<Account> hasher, HttpContext context, IConfiguration configuration) =>
        {
            if (string.IsNullOrWhiteSpace(input.Email) || input.Email.Length > 254 ||
                string.IsNullOrEmpty(input.Password) || input.Password.Length > 256)
                return Results.BadRequest(new { error = "Укажите почту и пароль." });

            var normalizedEmail = input.Email.Trim().ToUpperInvariant();
            var account = await db.Accounts.SingleOrDefaultAsync(account => account.NormalizedEmail == normalizedEmail,
                context.RequestAborted);
            var verification = hasher.VerifyHashedPassword(account ?? DummyAccount,
                account?.PasswordHash ?? DummyHash, input.Password);
            if (account is null || verification == PasswordVerificationResult.Failed || account.Status == "blocked")
            {
                // неудачная попытка — в журнал с введённой почтой (без пароля и адреса), как в Moodle
                var email = input.Email.Trim();
                AuditLog.Write(db, null, "auth.login_failed", "account", account?.Id, email,
                    account?.Status == "blocked" && verification != PasswordVerificationResult.Failed
                        ? [new AuditChange("Причина", null, "учётная запись заблокирована")]
                        : [new AuditChange("Причина", null, "неверная почта или пароль")],
                    actorName: email);
                await db.SaveChangesAsync(context.RequestAborted);
                return account is null || verification == PasswordVerificationResult.Failed
                    ? Results.Json(new { error = "Неверная почта или пароль." }, statusCode: 401)
                    : Results.Json(new { error = "Учётная запись заблокирована. Обратитесь к организатору." }, statusCode: 403);
            }
            if (verification == PasswordVerificationResult.SuccessRehashNeeded)
                account.PasswordHash = hasher.HashPassword(account, input.Password);
            AuditLog.Write(db, account, "auth.login", "account", account.Id, account.Name);

            await StartSessionAsync(db, account, context, configuration);
            return Results.Ok(UserInfo.From(account));
        }).RequireRateLimiting("login");

        auth.MapPost("/register", async (RegisterRequest input, LearningDbContext db,
            IPasswordHasher<Account> hasher, HttpContext context, IConfiguration configuration) =>
        {
            // выключатель — в настройках системы (администратор), начальное значение — Auth:AllowRegistration
            if (!(await AuditEndpoints.SettingsAsync(db, "pspu", configuration, context.RequestAborted)).AllowRegistration)
                return Results.Json(new { error = "Регистрация закрыта. Учётную запись создаст организатор." }, statusCode: 403);
            var fields = ValidateRegistration(input);
            if (fields.Count > 0) return Results.BadRequest(new { error = "Проверьте поля формы.", fields });

            var email = input.Email!.Trim();
            var normalizedEmail = email.ToUpperInvariant();
            if (await db.Accounts.AnyAsync(account => account.NormalizedEmail == normalizedEmail, context.RequestAborted))
                return EmailTaken();
            // Роль и группа от клиента не принимаются: сам регистрируется только студент, группу назначает организатор.
            var account = new Account
            {
                Id = $"u-{Guid.NewGuid():N}", Name = input.Name!.Trim(), Email = email,
                NormalizedEmail = normalizedEmail, Role = "student", TenantId = "pspu"
            };
            account.PasswordHash = hasher.HashPassword(account, input.Password!);
            db.Accounts.Add(account);
            AuditLog.Write(db, account, "auth.registered", "account", account.Id, $"{account.Name} · {account.Email}");
            try
            {
                await db.SaveChangesAsync(context.RequestAborted);
            }
            catch (DbUpdateException)
            {
                // Параллельная регистрация той же почты упирается в уникальный индекс.
                return EmailTaken();
            }
            await StartSessionAsync(db, account, context, configuration);
            return Results.Created("/api/auth/me", UserInfo.From(account));
        }).RequireRateLimiting("login");

        // смена своего пароля: старый, новый по правилам регистрации; остальные сессии закрываются
        auth.MapPost("/password", async (PasswordChangeRequest input, LearningDbContext db, IPasswordHasher<Account> hasher,
            HttpContext context) =>
        {
            var account = await db.Accounts.SingleAsync(item => item.Id == ((Account)context.Items[typeof(Account)]!).Id,
                context.RequestAborted);
            var fields = new Dictionary<string, string>();
            if (string.IsNullOrEmpty(input.CurrentPassword) || input.CurrentPassword.Length > 256 ||
                hasher.VerifyHashedPassword(account, account.PasswordHash, input.CurrentPassword) == PasswordVerificationResult.Failed)
                fields["currentPassword"] = "Текущий пароль неверный";
            if (PasswordError(input.NewPassword) is { } error) fields["newPassword"] = error;
            else if (input.NewPassword == input.CurrentPassword) fields["newPassword"] = "Новый пароль совпадает с текущим";
            if (fields.Count > 0) return Results.BadRequest(new { error = "Проверьте поля формы.", fields });
            account.PasswordHash = hasher.HashPassword(account, input.NewPassword!);
            account.MustChangePassword = false;
            var current = context.Request.Cookies.TryGetValue(SessionAuthentication.CookieName, out var token)
                ? SessionAuthentication.Hash(token) : "";
            await db.LoginSessions.Where(session => session.AccountId == account.Id && session.TokenHash != current)
                .ExecuteDeleteAsync(context.RequestAborted);
            AuditLog.Write(db, account, "password.changed", "account", account.Id, account.Name);
            await db.SaveChangesAsync(context.RequestAborted);
            return Results.Ok(UserInfo.From(account));
        }).RequireAuthorization().RequireRateLimiting("login").Produces<UserInfo>();

        auth.MapGet("/me", (HttpContext context) =>
            Results.Ok(UserInfo.From((Account)context.Items[typeof(Account)]!))).RequireAuthorization().Produces<UserInfo>();

        auth.MapPost("/logout", async (HttpContext context, LearningDbContext db, IConfiguration configuration) =>
        {
            if (context.Request.Cookies.TryGetValue(SessionAuthentication.CookieName, out var token))
            {
                var hash = SessionAuthentication.Hash(token);
                var session = await db.LoginSessions.Include(item => item.Account)
                    .SingleOrDefaultAsync(item => item.TokenHash == hash, context.RequestAborted);
                if (session is not null)
                {
                    AuditLog.Write(db, session.Account, "auth.logout", "account", session.Account.Id, session.Account.Name);
                    db.LoginSessions.Remove(session);
                    await db.SaveChangesAsync(context.RequestAborted);
                }
            }
            context.Response.Cookies.Delete(SessionAuthentication.CookieName, SessionAuthentication.Cookie(configuration));
            return Results.NoContent();
        });

        app.MapGet("/api/users/classmates", async (string group, HttpContext context,
            LearningDbContext db, CancellationToken cancellationToken) =>
        {
            var account = (Account)context.Items[typeof(Account)]!;
            if (string.IsNullOrWhiteSpace(group)) return Results.BadRequest(new { error = "Укажите группу." });
            if (!AccessRules.CanViewGroup(account, group)) return Results.StatusCode(403);
            var classmates = await db.Accounts.AsNoTracking().Where(user =>
                user.TenantId == account.TenantId && user.Group == group && user.Role == "student" && user.Status != "deleted")
                .OrderBy(user => user.Name).ToListAsync(cancellationToken);
            return Results.Ok(classmates.Select(user => new ClassmateInfo(user.Id, user.Name, user.Group)));
        }).RequireAuthorization().Produces<ClassmateInfo[]>();

        app.MapGet("/api/users", async (LearningDbContext db, CancellationToken cancellationToken) =>
        {
            // удалённые (обезличенные) не показываются: их данные видны только в оценках и журнале
            var accounts = await db.Accounts.AsNoTracking().Where(account => account.Status != "deleted")
                .OrderBy(account => account.Name).ToListAsync(cancellationToken);
            return Results.Ok(accounts.Select(UserInfo.From));
        }).RequireAuthorization(AccessRules.ManageUsers).Produces<UserInfo[]>();
    }

    private static IResult EmailTaken() => Results.Json(new
    {
        error = "Эта почта уже зарегистрирована.",
        fields = new Dictionary<string, string> { ["email"] = "Эта почта уже зарегистрирована" }
    }, statusCode: 409);

    // Те же правила, что в src/shared/lib/registration.ts.
    private static Dictionary<string, string> ValidateRegistration(RegisterRequest input)
    {
        var fields = new Dictionary<string, string>();
        var name = input.Name?.Trim() ?? "";
        var email = input.Email?.Trim() ?? "";
        if (name.Length < 2) fields["name"] = "Укажите имя и фамилию";
        else if (name.Length > 100) fields["name"] = "Имя длиннее 100 символов — сократите";

        if (email.Length == 0) fields["email"] = "Укажите почту";
        else if (email.Length > 254 || !LooksLikeEmail(email))
            fields["email"] = "Почта выглядит неполной, например name@pspu.ru";

        if (PasswordError(input.Password) is { } passwordError) fields["password"] = passwordError;

        if (input.Consent != true) fields["consent"] = "Без согласия мы не сможем создать учётную запись";
        return fields;
    }

    /// <summary>Правило пароля — как shared/lib/registration.ts (регистрация и смена пароля).</summary>
    private static string? PasswordError(string? password)
    {
        password ??= "";
        if (password.Length == 0) return "Придумайте пароль";
        if (password.Length > 256) return "Пароль длиннее 256 символов";
        if (password.Length < PasswordMin || !password.Any(char.IsLetter) || !password.Any(char.IsDigit))
            return $"Пароль: не короче {PasswordMin} символов, буквы и цифра";
        return null;
    }

    private static bool LooksLikeEmail(string email)
    {
        var at = email.IndexOf('@');
        return at > 0 && at == email.LastIndexOf('@') && !email.Any(char.IsWhiteSpace) &&
            email.IndexOf('.', at + 2) > at + 1 && !email.EndsWith('.');
    }

    // Новая сессия: просроченные удаляются, прежняя сессия этого браузера отзывается.
    private static async Task StartSessionAsync(LearningDbContext db, Account account, HttpContext context,
        IConfiguration configuration)
    {
        var now = DateTimeOffset.UtcNow;
        await db.LoginSessions.Where(session => session.ExpiresAt <= now).ExecuteDeleteAsync(context.RequestAborted);
        if (context.Request.Cookies.TryGetValue(SessionAuthentication.CookieName, out var previousToken))
            await db.LoginSessions.Where(session => session.TokenHash == SessionAuthentication.Hash(previousToken))
                .ExecuteDeleteAsync(context.RequestAborted);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expiresAt = now.AddHours(8);
        db.LoginSessions.Add(new LoginSession
        {
            TokenHash = SessionAuthentication.Hash(token), AccountId = account.Id, ExpiresAt = expiresAt
        });
        await db.SaveChangesAsync(context.RequestAborted);
        var cookie = SessionAuthentication.Cookie(configuration);
        cookie.Expires = expiresAt;
        context.Response.Cookies.Append(SessionAuthentication.CookieName, token, cookie);
    }
}
