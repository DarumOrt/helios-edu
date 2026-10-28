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
        users.MapDelete("/{id}", DeleteUserAsync);
        users.MapPost("/{id}/password-reset", ResetPasswordAsync).Produces<PasswordResetResult>();
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
        var password = TemporaryPassword();
        var account = new Account
        {
            Id = $"u-{Guid.NewGuid():N}", Name = input.Text("name"), Email = email,
            NormalizedEmail = normalized, Role = role, Status = "active", TenantId = actor.TenantId,
            Group = group?.Name, Faculty = input.OptionalText("faculty")
        };
        account.PasswordHash = hasher.HashPassword(account, password);
        // временный пароль — при первом входе попросить сменить
        account.MustChangePassword = true;
        db.Accounts.Add(account);
        AuditLog.Write(db, context, "user.created", "user", account.Id, $"{account.Name} · {account.Email}",
            AuditLog.Diff(("Роль", null, AuditLog.Role(account.Role)), ("Группа", null, account.Group),
                ("Факультет", null, account.Faculty)));
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Json(new { user = UserInfo.From(account), temporaryPassword = password }, statusCode: 201);
    }

    private static string TemporaryPassword() =>
        RandomNumberGenerator.GetString("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", 12);

    /// <summary>Пользователь, которого актор может менять: не он сам, не удалённый, администратора — только администратор.</summary>
    private static async Task<(Account? Account, IResult? Error)> ManagedAccount(LearningDbContext db, HttpContext context, string id)
    {
        var actor = Actor(context);
        var account = await db.Accounts.SingleOrDefaultAsync(user => user.Id == id && user.TenantId == actor.TenantId &&
            user.Status != "deleted", context.RequestAborted);
        if (account is null) return (null, Fail(404, "not found"));
        if (!AccessRules.CanManageUser(actor, account))
            return (null, Fail(403, "Учётные записи администраторов меняет только администратор"));
        return (account, null);
    }

    /// <summary>
    /// POST — новый временный пароль (показывается один раз): все сессии пользователя закрываются,
    /// при входе он сменит пароль на свой.
    /// </summary>
    private static async Task<IResult> ResetPasswordAsync(string id, HttpContext context, LearningDbContext db,
        IPasswordHasher<Account> hasher)
    {
        var (account, error) = await ManagedAccount(db, context, id);
        if (error is not null) return error;
        var password = TemporaryPassword();
        account!.PasswordHash = hasher.HashPassword(account, password);
        account.MustChangePassword = true;
        await db.LoginSessions.Where(session => session.AccountId == id).ExecuteDeleteAsync(context.RequestAborted);
        AuditLog.Write(db, context, "password.reset", "user", account.Id, $"{account.Name} · {account.Email}");
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(new PasswordResetResult(UserInfo.From(account), password));
    }

    /// <summary>
    /// DELETE — как в Moodle: если у пользователя есть учебные данные или курсы, он обезличивается
    /// («Удалённый пользователь», почта стёрта, вход закрыт) — оценки, работы и журнал остаются;
    /// без данных — удаляется полностью. Себя удалить нельзя.
    /// </summary>
    private static async Task<IResult> DeleteUserAsync(string id, HttpContext context, LearningDbContext db,
        IPasswordHasher<Account> hasher)
    {
        if (id == Actor(context).Id) return Fail(400, "Себя удалить нельзя");
        var (account, error) = await ManagedAccount(db, context, id);
        if (error is not null) return error;
        var token = context.RequestAborted;
        var hasData = await db.Submissions.AnyAsync(item => item.UserId == id, token) ||
            await db.Grades.AnyAsync(item => item.UserId == id, token) ||
            await db.QuizAttempts.AnyAsync(item => item.UserId == id, token) ||
            await db.SkillMastery.AnyAsync(item => item.UserId == id, token) ||
            await db.Recommendations.AnyAsync(item => item.UserId == id, token) ||
            await db.StudentPins.AnyAsync(item => item.UserId == id, token) ||
            await db.LearningEvents.AnyAsync(item => item.UserId == id || item.ActorId == id, token) ||
            await db.ActivityProgress.AnyAsync(item => item.UserId == id, token) ||
            await db.Files.AnyAsync(item => item.OwnerId == id, token) ||
            await db.Courses.AnyAsync(course => course.TutorId == id, token);
        var name = $"{account!.Name} · {account.Email}";
        await db.LoginSessions.Where(session => session.AccountId == id).ExecuteDeleteAsync(token);
        AuditLog.Write(db, context, "user.deleted", "user", account.Id, name,
            [new AuditChange("Как", null, hasData ? "обезличен: оценки и работы сохранены" : "удалён полностью")]);
        if (hasData)
        {
            account.Name = "Удалённый пользователь";
            account.Email = $"deleted-{account.Id}@deleted.invalid";
            account.NormalizedEmail = account.Email.ToUpperInvariant();
            account.PasswordHash = hasher.HashPassword(account, TemporaryPassword() + TemporaryPassword());
            account.Faculty = null;
            account.Status = "deleted";
            account.MustChangePassword = false;
        }
        else db.Accounts.Remove(account);
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateUserAsync(string id, HttpContext context, LearningDbContext db)
    {
        var actor = Actor(context);
        var account = await db.Accounts.SingleOrDefaultAsync(user => user.Id == id && user.TenantId == actor.TenantId &&
            user.Status != "deleted",
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
