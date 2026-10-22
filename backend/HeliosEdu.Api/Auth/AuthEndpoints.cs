using System.Security.Cryptography;
using HeliosEdu.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Auth;

public static class AuthEndpoints
{
    private static readonly Account DummyAccount = new();
    private static readonly string DummyHash = new PasswordHasher<Account>().HashPassword(DummyAccount, "not-an-account");
    public sealed record LoginRequest(string? Email, string? Password);

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
            if (account is null || verification == PasswordVerificationResult.Failed)
                return Results.Json(new { error = "Неверная почта или пароль." }, statusCode: 401);
            if (verification == PasswordVerificationResult.SuccessRehashNeeded)
                account.PasswordHash = hasher.HashPassword(account, input.Password);

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
            return Results.Ok(UserInfo.From(account));
        }).RequireRateLimiting("login");

        auth.MapGet("/me", (HttpContext context) =>
            Results.Ok(UserInfo.From((Account)context.Items[typeof(Account)]!))).RequireAuthorization();

        auth.MapPost("/logout", async (HttpContext context, LearningDbContext db, IConfiguration configuration) =>
        {
            if (context.Request.Cookies.TryGetValue(SessionAuthentication.CookieName, out var token))
                await db.LoginSessions.Where(session => session.TokenHash == SessionAuthentication.Hash(token))
                    .ExecuteDeleteAsync(context.RequestAborted);
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
                user.TenantId == account.TenantId && user.Group == group && user.Role == "student")
                .OrderBy(user => user.Name).ToListAsync(cancellationToken);
            return Results.Ok(classmates.Select(UserInfo.From));
        }).RequireAuthorization();

        app.MapGet("/api/users", async (LearningDbContext db, CancellationToken cancellationToken) =>
        {
            var accounts = await db.Accounts.AsNoTracking().OrderBy(account => account.Name).ToListAsync(cancellationToken);
            return Results.Ok(accounts.Select(UserInfo.From));
        }).RequireAuthorization(AccessRules.ManageUsers);
    }
}
