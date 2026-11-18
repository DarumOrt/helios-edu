using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Auth;

/// <summary>Роль аккаунта хранится отдельно от проверочной роли конкретной сессии.</summary>
public static class RolePreview
{
    public sealed record Selection(string? Role, string? CourseId);
    private const string Header = "X-Helios-Preview";
    internal const string Group = "Проверочная группа";
    internal static string Schema(Guid id) => $"helios_preview_{id:N}";

    internal static Account Actor(string role, string tenant) => new()
    {
        Id = $"preview-{role}", Role = role, TenantId = tenant,
        Name = role switch { "student" => "Тестовый студент", "tutor" => "Тестовый преподаватель", _ => "Тестовый организатор" },
        Email = $"{role}@preview.invalid", NormalizedEmail = $"{role.ToUpperInvariant()}@PREVIEW.INVALID",
        Group = role == "student" ? Group : null
    };

    private static LoginSession? Session(HttpContext http) => http.Items[typeof(LoginSession)] as LoginSession;
    private static string? Key(LoginSession? s) => s?.Account.Role == "admin" && s.PreviewId is Guid id
        ? $"{id:N}.{s.PreviewRole}" : null;
    public static string? ContextKey(HttpContext http) => Key(Session(http));

    public static async Task RouteRequest(HttpContext http, RequestDelegate next)
    {
        var req = http.Request;
        var key = ContextKey(http);
        var write = !HttpMethods.IsGet(req.Method) && !HttpMethods.IsHead(req.Method);
        if (write && req.Headers[Header].ToString() != (key ?? ""))
        {
            await ManagementValidation.Fail(409, "Режим кабинета изменился. Обновите страницу.").ExecuteAsync(http);
            return;
        }
        var readsBrand = HttpMethods.IsGet(req.Method) && (req.Path == "/api/branding" || req.Path == "/api/branding/logo");
        if (key == null || readsBrand || req.Path == "/api/auth/preview" || req.Path == "/api/auth/logout")
        {
            await next(http);
            return;
        }
        // Внешние ресурсы общие для всей установки. Проверочная копия может читать файлы материалов.
        if (write && (req.Path.StartsWithSegments("/api/files") || req.Path.StartsWithSegments("/api/mail") ||
                      req.Path.StartsWithSegments("/api/auth")))
        {
            await ManagementValidation.Fail(403, "Это действие доступно в основном кабинете").ExecuteAsync(http);
            return;
        }
        var db = http.RequestServices.GetRequiredService<LearningDbContext>();
        db.SuppressMail = true;
        // search_path без public: даже при одновременном завершении проверки запрос не попадёт в рабочие таблицы.
        await db.Database.OpenConnectionAsync(http.RequestAborted);
        try
        {
            var schema = Schema(Session(http)!.PreviewId!.Value);
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT set_config('search_path', {schema}, false)", http.RequestAborted);
            await next(http);
        }
        finally
        {
            try { await db.Database.ExecuteSqlRawAsync("RESET search_path", CancellationToken.None); }
            finally { await db.Database.CloseConnectionAsync(); }
        }
    }

    public static void MapRolePreview(this WebApplication app)
    {
        var route = app.MapGroup("/api/auth/preview").RequireAuthorization().AddEndpointFilter<ManagementWriteFilter>();
        route.MapPost("", (Selection input, HttpContext http, LearningDbContext db) => Change(http, db, input))
            .Produces<UserInfo>();
        route.MapDelete("", (HttpContext http, LearningDbContext db) => Change(http, db, null)).Produces<UserInfo>();
    }

    private static async Task<IResult> Change(HttpContext http, LearningDbContext db, Selection? input)
    {
        var authenticated = Session(http)!;
        var ct = http.RequestAborted;
        if (authenticated.Account.Role != "admin") return ManagementValidation.Fail(403, "Только для администратора");
        if (input != null && input.Role is not ("student" or "tutor" or "organizer"))
            return ManagementValidation.Fail(400, "Выберите роль для проверки");

        var session = await db.LoginSessions.FromSqlInterpolated(
            $"SELECT * FROM \"LoginSessions\" WHERE \"TokenHash\" = {authenticated.TokenHash} FOR UPDATE")
            .Include(s => s.Account).SingleOrDefaultAsync(ct);
        if (session == null || session.Account.Role != "admin" || session.Account.Status != "active")
            return ManagementValidation.Fail(403, "Сессия администратора завершена");
        if (Key(session) != ContextKey(http)) return ManagementValidation.Fail(409, "Режим уже изменён. Обновите страницу.");
        if (input == null)
        {
            session.PreviewId = null;
            session.PreviewRole = null;
            await db.SaveChangesAsync(ct);
            return Results.Ok(UserInfo.From(session.Account));
        }
        if (session.PreviewId == null)
        {
            var id = Guid.NewGuid();
            // Поля сессии и схема создаются или откатываются вместе фильтром ManagementWriteFilter.
            session.PreviewId = id;
            session.PreviewRole = input.Role;
            db.SuppressMail = true;
            await db.SaveChangesAsync(ct);
            if (!await PreviewCourse.Create(db, id, session.Account.TenantId, input.CourseId, ct))
                return ManagementValidation.Fail(404, "Курс не найден");
        }
        else
        {
            session.PreviewRole = input.Role;
            await db.SaveChangesAsync(ct);
        }
        return Results.Ok(UserInfo.From(Actor(input.Role!, session.Account.TenantId)) with { PreviewContext = Key(session) });
    }
}
