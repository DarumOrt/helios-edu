using HeliosEdu.Api.Audit;
using System.Security.Cryptography;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Mail;
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
        users.MapGet("/directory", UserDirectoryAsync).Produces<UserDirectory>();
        users.MapPost("", CreateUserAsync);
        users.MapPatch("/{id}", UpdateUserAsync);
        users.MapDelete("/{id}", DeleteUserAsync);
        users.MapPost("/{id}/password-reset", ResetPasswordAsync).Produces<PasswordResetResult>();
        users.MapPost("/{id}/application", ApproveApplicationAsync).Produces<UserInfo>();
        users.MapDelete("/{id}/application", RejectApplicationAsync);
        MapFaculties(app);
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
        var faculty = input.OptionalText("faculty") ?? group?.Faculty;
        await ValidateFaculty(context, db, faculty, fields);
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
            Group = group?.Name, Faculty = faculty
        };
        if (await ApplyOrganizerScope(context, db, input, account, role) is { } scopeError) return scopeError;
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
            return (null, Fail(403, "Учётные записи администраторов и других организаторов меняет администратор"));
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
        if (account!.Status == Account.Pending) return Fail(409, "Сначала назначьте роль");
        var password = TemporaryPassword();
        account.PasswordHash = hasher.HashPassword(account, password);
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
        if (account!.Status == Account.Pending) return Fail(409, "Отклоните заявку в списке «Без роли»");
        var hasData = await db.Submissions.AnyAsync(item => item.UserId == id, token) ||
            await db.Grades.AnyAsync(item => item.UserId == id, token) ||
            await db.QuizAttempts.AnyAsync(item => item.UserId == id, token) ||
            await db.SkillMastery.AnyAsync(item => item.UserId == id, token) ||
            await db.Recommendations.AnyAsync(item => item.UserId == id, token) ||
            await db.StudentPins.AnyAsync(item => item.UserId == id, token) ||
            await db.LearningEvents.AnyAsync(item => item.UserId == id || item.ActorId == id, token) ||
            await db.ActivityProgress.AnyAsync(item => item.UserId == id, token) ||
            await db.Files.AnyAsync(item => item.OwnerId == id, token) ||
            await db.Courses.IgnoreQueryFilters().AnyAsync(course => course.TutorId == id, token);
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
            account.OrganizerFaculties = null;
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
            return Fail(403, "Учётные записи администраторов и других организаторов меняет администратор");
        if (account.Status == Account.Pending) return Fail(409, "Сначала назначьте роль");
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var role = input.Choice("role", account.Role);
        var fields = User(input, true, role);
        if (!fields.ContainsKey("role") && input.Has("role") && role != account.Role)
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
        var faculty = input.Has("faculty") ? input.OptionalText("faculty") : account.Faculty;
        if (input.Has("faculty") || input.Has("group")) await ValidateFaculty(context, db, faculty ?? group?.Faculty, fields, account.Faculty);
        if (fields.Count > 0) return Invalid(fields);
        if (await ApplyOrganizerScope(context, db, input, account, role) is { } scopeError) return scopeError;
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
        if (input.Has("faculty")) account.Faculty = faculty;
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

    private static async Task<IResult> ApproveApplicationAsync(string id, HttpContext context, LearningDbContext db,
        MailService mail)
    {
        var input = await ManagementInput.ReadAsync(context.Request);
        if (input is null) return Fail(400, "Некорректный запрос");
        var actor = Actor(context);
        var token = context.RequestAborted;
        var role = input.Choice("role");
        var fields = User(input, true, role);
        if (!fields.ContainsKey("role") && !AccessRules.CanAssignRole(actor, role))
            fields["role"] = "Эту роль может назначить только администратор";
        if (fields.Count > 0) return Invalid(fields);

        var account = await db.Accounts.FromSqlInterpolated(
            $"SELECT * FROM \"Accounts\" WHERE \"Id\" = {id} AND \"TenantId\" = {actor.TenantId} AND \"Status\" = {Account.Pending} FOR UPDATE")
            .SingleOrDefaultAsync(token);
        if (account is null) return Fail(409, "Заявка уже обработана или не найдена");
        if (!mail.InvitationsConfigured || !await MailEndpoints.Ready(db, actor.TenantId, token))
            return Fail(409, "Для отправки приглашения администратор должен настроить почту");
        Cohort? group = null;
        if (input.OptionalText("group") is { } groupName)
        {
            group = await CanonicalGroup(db, groupName, actor.TenantId, token);
            if (group is null) return Invalid(new() { ["group"] = "Такой группы нет" });
        }
        await ValidateFaculty(context, db, input.OptionalText("faculty") ?? group?.Faculty, fields);
        if (fields.Count > 0) return Invalid(fields);
        if (await ApplyOrganizerScope(context, db, input, account, role) is { } scopeError) return scopeError;
        account.Role = role;
        account.Status = "active";
        account.Group = group?.Name;
        account.Faculty = input.OptionalText("faculty") ?? group?.Faculty;
        await mail.Invite(db, account, $"approval:{id}", token);
        AuditLog.Write(db, context, "user.application_approved", "user", id, account.Email,
            AuditLog.Diff(("Роль", null, AuditLog.Role(role)), ("Группа", null, account.Group),
                ("Факультет", null, account.Faculty)));
        await db.SaveChangesAsync(token);
        return Results.Ok(UserInfo.From(account));
    }

    private static async Task<IResult> RejectApplicationAsync(string id, HttpContext context, LearningDbContext db)
    {
        var tenant = Actor(context).TenantId;
        var token = context.RequestAborted;
        var removed = await db.Accounts.Where(account => account.Id == id && account.TenantId == tenant &&
            account.Status == Account.Pending).ExecuteDeleteAsync(token);
        if (removed == 0) return Fail(409, "Заявка уже обработана или не найдена");
        AuditLog.Write(db, context, "user.application_rejected", "user", id, "Заявка на доступ");
        await db.SaveChangesAsync(token);
        return Results.NoContent();
    }
}
