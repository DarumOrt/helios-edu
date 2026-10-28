using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using HeliosEdu.Api.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HeliosEdu.Api.Auth;

// В cookie хранится случайный токен, в базе — только его хеш. Роль читается из базы.
public sealed class SessionAuthentication(
    IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger,
    UrlEncoder encoder, LearningDbContext db)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Session";
    public const string CookieName = "helios-auth";
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    public static CookieOptions Cookie(IConfiguration configuration) => new()
    {
        HttpOnly = true,
        Secure = !configuration.GetValue<bool>("Auth:AllowInsecureCookies"),
        SameSite = SameSiteMode.Lax,
        Path = "/"
    };

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Cookies.TryGetValue(CookieName, out var token)) return AuthenticateResult.NoResult();
        if (token.Length != 64 || !token.All(Uri.IsHexDigit)) return AuthenticateResult.Fail("Неверная сессия.");
        var tokenHash = Hash(token);
        var session = await db.LoginSessions.AsNoTracking().Include(session => session.Account)
            .SingleOrDefaultAsync(session => session.TokenHash == tokenHash &&
                session.ExpiresAt > DateTimeOffset.UtcNow, Context.RequestAborted);
        if (session is null || session.Account.Status is "blocked" or "deleted") return AuthenticateResult.Fail("Сессия завершена.");
        Context.Items[typeof(Account)] = session.Account;
        var identity = new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, session.AccountId),
            new Claim(ClaimTypes.Role, session.Account.Role),
            new Claim(ClaimTypes.Name, session.Account.Name)
        ], SchemeName);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }

    protected override Task HandleForbiddenAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = 403;
        return Response.WriteAsJsonAsync(new { error = "Недостаточно прав" });
    }
}
