using HeliosEdu.Api.Audit;
using System.Security.Cryptography;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Management;

public static partial class ManagementEndpoints
{
    public static void MapManagementEndpoints(this WebApplication app)
    {
        var users = app.MapGroup("/api/users").RequireAuthorization(AccessRules.ManageUsers)
            .AddEndpointFilter<ManagementWriteFilter>();
        users.MapPost("", CreateUserAsync);
        users.MapPatch("/{id}", UpdateUserAsync);
        MapCohorts(app);
        MapCourses(app);
    }

    private static Account Actor(HttpContext context) => (Account)context.Items[typeof(Account)]!;

    private static async Task<Cohort?> CanonicalGroup(LearningDbContext db, string name, string tenant,
        CancellationToken cancellationToken)
    {
        var normalized = name.Trim().ToUpperInvariant();
        // Блокировка согласует назначение с одновременными переименованием и удалением группы.
        return await db.Cohorts.FromSqlInterpolated($"SELECT * FROM \"Cohorts\" WHERE \"NormalizedName\" = {normalized} AND \"TenantId\" = {tenant} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);
    }

    private static async Task<IResult> CreateUserAsync(HttpContext context, LearningDbContext db,
        IPasswordHasher<Account> hasher)
    {
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var actor = Actor(context);
        var role = input.Choice("role");
        // POST игнорирует status: новый пользователь всегда активен, как в моках.
        var fields = User(input, false, role);
        fields.Remove("status");
        if (!fields.ContainsKey("role") && !AccessRules.CanAssignRole(actor, role))
            fields["role"] = "Эту роль может назначить только администратор";
        Cohort? group = null;
        if (input.OptionalText("group") is { } groupName && !fields.ContainsKey("group"))
        {
            group = await CanonicalGroup(db, groupName, actor.TenantId, context.RequestAborted);
            if (group is null) fields["group"] = "Такой группы нет";
        }
        if (fields.Count > 0) return Invalid(fields);
        var email = input.Text("email");
        var normalized = email.ToUpperInvariant();
        if (await db.Accounts.AnyAsync(account => account.NormalizedEmail == normalized, context.RequestAborted))
            return Duplicate("email", "Эта почта уже зарегистрирована");
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        var password = RandomNumberGenerator.GetString(alphabet, 12);
        var account = new Account
        {
            Id = $"u-{Guid.NewGuid():N}", Name = input.Text("name"), Email = email,
            NormalizedEmail = normalized, Role = role, Status = "active", TenantId = actor.TenantId,
            Group = group?.Name, Faculty = input.OptionalText("faculty")
        };
        account.PasswordHash = hasher.HashPassword(account, password);
        db.Accounts.Add(account);
        AuditLog.Write(db, context, "user.created", "user", account.Id, $"{account.Name} · {account.Email}",
            AuditLog.Diff(("Роль", null, AuditLog.Role(account.Role)), ("Группа", null, account.Group),
                ("Факультет", null, account.Faculty)));
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Json(new { user = UserInfo.From(account), temporaryPassword = password }, statusCode: 201);
    }

    private static async Task<IResult> UpdateUserAsync(string id, HttpContext context, LearningDbContext db)
    {
        var actor = Actor(context);
        var account = await db.Accounts.SingleOrDefaultAsync(user => user.Id == id && user.TenantId == actor.TenantId,
            context.RequestAborted);
        if (account is null) return Fail(404, "not found");
        if (!AccessRules.CanManageUser(actor, account))
            return Fail(403, "Учётные записи администраторов меняет только администратор");
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var role = input.Choice("role", account.Role);
        var fields = User(input, true, role);
        if (input.Has("role") && role != account.Role)
        {
            if (actor.Id == id) fields["role"] = "Свою роль изменить нельзя";
            else if (!AccessRules.CanAssignRole(actor, role)) fields["role"] = "Эту роль может назначить только администратор";
        }
        if (input.Choice("status") == "blocked" && actor.Id == id) fields["status"] = "Себя заблокировать нельзя";
        var groupName = input.Has("group") ? input.OptionalText("group") : account.Group;
        Cohort? group = null;
        if (groupName is not null && role == "student" && !fields.ContainsKey("group"))
        {
            group = await CanonicalGroup(db, groupName, actor.TenantId, context.RequestAborted);
            if (group is null) fields["group"] = "Такой группы нет";
        }
        if (fields.Count > 0) return Invalid(fields);
        var before = (account.Name, account.Email, account.Role, account.Group, account.Faculty, account.Status);
        if (input.Has("email"))
        {
            var normalized = input.Text("email").ToUpperInvariant();
            if (await db.Accounts.AnyAsync(user => user.NormalizedEmail == normalized && user.Id != id, context.RequestAborted))
                return Duplicate("email", "Эта почта уже зарегистрирована");
            account.Email = input.Text("email");
            account.NormalizedEmail = normalized;
        }
        if (input.Has("name")) account.Name = input.Text("name");
        if (input.Has("faculty")) account.Faculty = input.OptionalText("faculty");
        if (input.Has("status")) account.Status = input.Choice("status");
        account.Role = role;
        account.Group = role == "student" ? group?.Name : null;
        if (account.Status == "blocked")
            await db.LoginSessions.Where(session => session.AccountId == id).ExecuteDeleteAsync(context.RequestAborted);
        var changes = AuditLog.Diff(("Имя", before.Name, account.Name), ("Почта", before.Email, account.Email),
            ("Роль", AuditLog.Role(before.Role), AuditLog.Role(account.Role)), ("Группа", before.Group, account.Group),
            ("Факультет", before.Faculty, account.Faculty),
            ("Статус", AuditLog.Status(before.Status), AuditLog.Status(account.Status)));
        if (changes.Count > 0)
            AuditLog.Write(db, context, before.Status != account.Status
                    ? account.Status == "blocked" ? "user.blocked" : "user.unblocked"
                    : "user.updated",
                "user", account.Id, $"{account.Name} · {account.Email}", changes);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(UserInfo.From(account));
    }
}
