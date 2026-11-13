using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HeliosEdu.Api.Audit;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Mail;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using static HeliosEdu.Api.Management.ManagementValidation;

namespace HeliosEdu.Api.Management;

public sealed record ImportInput(string RequestId, string Csv, Dictionary<string, int>? Columns, string? Group,
    bool UpdateExisting = false, bool SendInvitations = true);
public sealed record ImportRow(int Row, string Name, string Email, string? Group, string Status, string? Error);
public sealed record ImportReport(int Created, int Updated, int Skipped, int Errors, List<ImportRow> Rows);

public static class CsvImport
{
    // RFC 4180: кавычки, удвоенные кавычки и переносы внутри поля; BOM и оба разделителя.
    public static List<string[]> Parse(string text)
    {
        text = text.TrimStart('\uFEFF');
        var first = text.Split('\n')[0];
        var delimiter = Count(first, ';') > Count(first, ',') ? ';' : ',';
        var rows = new List<string[]>(); var row = new List<string>(); var cell = new StringBuilder();
        var quoted = false; var closed = false;
        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (quoted)
            {
                if (c == '"' && i + 1 < text.Length && text[i + 1] == '"') { cell.Append('"'); i++; }
                else if (c == '"') { quoted = false; closed = true; }
                else cell.Append(c);
            }
            else if (c == '"' && cell.Length == 0 && !closed) quoted = true;
            else if (c == delimiter || c is '\r' or '\n')
            {
                row.Add(cell.ToString().Trim()); cell.Clear(); closed = false;
                if (c != delimiter)
                {
                    if (row.Any(x => x.Length > 0)) rows.Add(row.ToArray());
                    row.Clear();
                    if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++;
                }
            }
            else if (closed || c == '"') throw new FormatException("Некорректные кавычки CSV");
            else cell.Append(c);
            if (rows.Count > 1000 || row.Count > 50 || cell.Length > 1000) throw new FormatException("CSV: до 1000 строк, 50 колонок и 1000 символов в поле");
        }
        if (quoted) throw new FormatException("Незакрытая кавычка CSV");
        row.Add(cell.ToString().Trim());
        if (row.Any(x => x.Length > 0)) rows.Add(row.ToArray());
        if (rows.Count is < 2 or > 1001) throw new FormatException("CSV должен содержать заголовок и от 1 до 1000 строк");
        return rows;
    }
    private static int Count(string s, char delimiter)
    {
        var quoted = false; var count = 0;
        foreach (var c in s) { if (c == '"') quoted = !quoted; else if (!quoted && c == delimiter) count++; }
        return count;
    }

    public static void MapImportEndpoints(this WebApplication app)
    {
        var routes = app.MapGroup("/api/users/import").RequireAuthorization(AccessRules.ManageSystem)
            .AddEndpointFilter<ManagementWriteFilter>();
        routes.MapPost("/preview", (ImportInput input, HttpContext c, LearningDbContext db) => Run(input, false, c, db))
            .Produces<ImportReport>();
        routes.MapPost("", (ImportInput input, HttpContext c, LearningDbContext db) => Run(input, true, c, db))
            .RequireRateLimiting("mail").Produces<ImportReport>();
    }

    private static async Task<IResult> Run(ImportInput input, bool commit, HttpContext c, LearningDbContext db)
    {
        if (!Guid.TryParse(input.RequestId, out _) || input.Csv is null || Encoding.UTF8.GetByteCount(input.Csv) > 1_000_000)
            return Fail(400, "CSV: размер до 1 МБ; укажите идентификатор операции");
        var actor = (Account)c.Items[typeof(Account)]!; var ct = c.RequestAborted;
        db.SuppressInvitations = true; // выбор администратора в форме импорта имеет приоритет
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(74982103)", ct);
        var fingerprint = MailService.Fingerprint(input);
        var prior = await db.Set<UserImport>().SingleOrDefaultAsync(x => x.TenantId == actor.TenantId && x.RequestId == input.RequestId, ct);
        if (prior is not null) return prior.Fingerprint != fingerprint ? Fail(409, "Идентификатор уже использован для другого импорта") :
            Results.Ok(JsonSerializer.Deserialize<ImportReport>(prior.Report));
        List<string[]> csv;
        try { csv = Parse(input.Csv); } catch (FormatException e) { return Fail(400, e.Message); }
        var columns = input.Columns ?? csv[0].Select((s, i) => (s, i)).Where(x => x.s is "name" or "email" or "group" or "faculty")
            .GroupBy(x => x.s).ToDictionary(g => g.Key, g => g.First().i);
        if (!columns.ContainsKey("name") || !columns.ContainsKey("email") || columns.Keys.Any(k => k is not ("name" or "email" or "group" or "faculty")) ||
            columns.Values.Any(i => i < 0 || i >= csv[0].Length) || columns.Values.Distinct().Count() != columns.Count)
            return Fail(400, "Сопоставьте уникальные колонки имени и почты; роли через CSV не изменяются");
        var groups = await db.Cohorts.FromSqlInterpolated($"SELECT * FROM \"Cohorts\" WHERE \"TenantId\" = {actor.TenantId} ORDER BY \"Id\" FOR UPDATE").ToListAsync(ct);
        var mail = c.RequestServices.GetRequiredService<MailService>();
        var hasher = c.RequestServices.GetRequiredService<IPasswordHasher<Account>>();
        var publicUrl = c.RequestServices.GetRequiredService<IConfiguration>()["Mail:PublicUrl"];
        if (commit && input.SendInvitations && (!await MailEndpoints.Ready(db, actor.TenantId, ct) ||
            !Uri.TryCreate(publicUrl, UriKind.Absolute, out var uri) || (uri.Scheme != "https" && !(uri.IsLoopback && uri.Scheme == "http"))))
            return Fail(400, "Для приглашений настройте SMTP и Mail__PublicUrl; либо отключите отправку приглашений");
        var report = new List<ImportRow>(); var seen = new HashSet<string>();
        var created = 0; var updated = 0; var skipped = 0; var errors = 0;
        for (var i = 1; i < csv.Count; i++)
        {
            var cells = csv[i]; string Cell(string key) => columns.TryGetValue(key, out var index) && index < cells.Length ? cells[index] : "";
            var name = Cell("name"); var email = Cell("email"); var groupName = string.IsNullOrWhiteSpace(input.Group) ? Cell("group") : input.Group.Trim();
            var group = groups.SingleOrDefault(g => g.NormalizedName == groupName.ToUpperInvariant());
            var normalized = email.ToUpperInvariant(); var faculty = Cell("faculty");
            var error = cells.Length != csv[0].Length ? "Количество полей не совпадает с заголовком" :
                name.Length is < 2 or > 100 ? "Укажите имя и фамилию — от 2 до 100 символов" :
                !MailService.EmailValid(email) ? "Почта выглядит неполной, например name@pspu.ru" :
                faculty.Length > 50 ? "Факультет — до 50 символов" : groupName.Length > 0 && group is null ? "Такой группы нет" : null;
            if (error is not null) { errors++; report.Add(new(i + 1, name, email, groupName, "error", error)); continue; }
            if (!seen.Add(normalized)) { skipped++; report.Add(new(i + 1, name, email, groupName, "skipped", "Повтор почты в CSV")); continue; }
            var existing = await db.Accounts.SingleOrDefaultAsync(u => u.NormalizedEmail == normalized, ct);
            if (existing is not null)
            {
                if (existing.TenantId != actor.TenantId || existing.Status != "active")
                { errors++; report.Add(new(i + 1, name, email, groupName, "error", "Адрес недоступен для импорта")); continue; }
                if (input.UpdateExisting && group is not null && existing.Role == "student" && existing.Group != group.Name)
                {
                    if (commit) { existing.Group = group.Name; await db.SaveChangesAsync(ct); }
                    updated++; report.Add(new(i + 1, name, email, groupName, "updated", null));
                }
                else { skipped++; report.Add(new(i + 1, name, email, groupName, "skipped", "Учётная запись уже существует; данные сохранены")); }
                continue;
            }
            if (commit)
            {
                var tracked = db.ChangeTracker.Entries().Select(e => e.Entity).ToHashSet();
                var user = new Account { Id = $"u-{Guid.NewGuid():N}", Name = name, Email = email, NormalizedEmail = normalized,
                    Role = "student", TenantId = actor.TenantId, Group = group?.Name, Faculty = faculty.Length > 0 ? faculty : null, MustChangePassword = true };
                user.PasswordHash = hasher.HashPassword(user, Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));
                db.Add(user);
                if (input.SendInvitations) await mail.Invite(db, user, $"import:{input.RequestId}:{i}", ct);
                try { await db.SaveChangesAsync(ct); }
                catch (DbUpdateException exception) when (exception.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation, ConstraintName: "IX_Accounts_NormalizedEmail" })
                {
                    // EF откатывает эту строку до savepoint, остальные корректные строки остаются.
                    foreach (var entry in db.ChangeTracker.Entries().Where(e => !tracked.Contains(e.Entity)).ToList()) entry.State = EntityState.Detached;
                    skipped++; report.Add(new(i + 1, name, email, groupName, "skipped", "Учётная запись создана параллельно; данные сохранены"));
                    continue;
                }
            }
            created++; report.Add(new(i + 1, name, email, groupName, "created", null));
        }
        var result = new ImportReport(created, updated, skipped, errors, report);
        if (commit)
        {
            db.Add(new UserImport { TenantId = actor.TenantId, RequestId = input.RequestId, Fingerprint = fingerprint, Report = JsonSerializer.Serialize(result) });
            AuditLog.Write(db, c, "user.import", "users", null, $"Импорт: создано {created}, обновлено {updated}, пропущено {skipped}, ошибок {errors}");
            await db.SaveChangesAsync(ct);
        }
        return Results.Ok(result);
    }
}
