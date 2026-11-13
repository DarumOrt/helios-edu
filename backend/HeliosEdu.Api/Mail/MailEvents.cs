using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Data;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Mail;

public static class MailEvents
{
    // Только текущие изменения: миграции и начальные данные не вызывают писем.
    public static async Task Collect(LearningDbContext db, MailService mail, CancellationToken ct)
    {
        var accounts = db.ChangeTracker.Entries<Account>().Where(e => e.State is EntityState.Added or EntityState.Modified).ToList();
        var courses = db.ChangeTracker.Entries<Course>().Where(e => e.State == EntityState.Modified &&
            e.Property(c => c.Status).IsModified && e.Entity.Status == "published" && e.OriginalValues.GetValue<string>("Status") != "published").ToList();
        var links = db.ChangeTracker.Entries<CohortCourse>().Where(e => e.State == EntityState.Added).Select(e => e.Entity).ToList();
        var removed = db.ChangeTracker.Entries<CohortCourse>().Where(e => e.State == EntityState.Deleted).Select(e => e.Entity).ToList();
        if (accounts.Count + courses.Count + links.Count == 0) return;
        var settings = await db.Set<MailSettings>().Where(s => s.Host != "").ToListAsync(ct);
        foreach (var s in settings)
        {
            void Queue(string subject, string text, IEnumerable<Account> recipients)
            {
                var users = recipients.Where(u => u.Status == "active").ToList();
                if (users.Count > 0) mail.Enqueue(db, s.TenantId, $"auto:{Guid.NewGuid():N}", "event", subject, new MailBody(text, null), users);
            }
            foreach (var e in accounts.Where(e => e.Entity.TenantId == s.TenantId && e.Entity.Status == "active"))
            {
                if (!db.SuppressInvitations && s.Invitation && e.State == EntityState.Added && e.Entity.MustChangePassword &&
                    !db.ChangeTracker.Entries<AccountActivation>().Any(a => a.Entity.AccountId == e.Entity.Id))
                    await mail.Invite(db, e.Entity, $"auto-invite:{e.Entity.Id}", ct);
                if (s.UserCreated && e.State == EntityState.Added)
                    Queue("Учётная запись HeliosEDU создана", $"Здравствуйте, {e.Entity.Name}! Ваша учётная запись создана.", [e.Entity]);
                if (e.Entity.Group is { } name && (e.State == EntityState.Added || e.Property(a => a.Group).IsModified && e.OriginalValues.GetValue<string?>("Group") != name))
                {
                    if (s.GroupAdded) Queue("Вы добавлены в учебную группу", $"Ваша группа: {name}", [e.Entity]);
                    if (s.CourseAssigned)
                    {
                        var titles = await db.Courses.Where(c => c.DeletedAt == null && c.Status == "published" && db.CohortCourses.Any(l =>
                            l.CourseId == c.Id && db.Cohorts.Any(g => g.Id == l.CohortId && g.TenantId == s.TenantId && g.Name == name)))
                            .Select(c => c.Title).ToListAsync(ct);
                        if (titles.Count > 0) Queue("Вам назначены курсы", string.Join("\n", titles), [e.Entity]);
                    }
                }
            }
            foreach (var e in courses)
                if (s.CoursePublished)
                {
                    var removedIds = removed.Where(l => l.CourseId == e.Entity.Id).Select(l => l.CohortId).ToArray();
                    var users = await AccessRules.CourseStudents(db, e.Entity.Id).Where(u => u.TenantId == s.TenantId &&
                        !db.Cohorts.Any(g => removedIds.Contains(g.Id) && g.TenantId == s.TenantId && g.Name == u.Group)).ToListAsync(ct);
                    var addedGroups = links.Where(l => l.CourseId == e.Entity.Id).Select(l => l.CohortId).ToList();
                    users.AddRange(await db.Accounts.Where(u => u.TenantId == s.TenantId && u.Role == "student" && db.Cohorts.Any(g =>
                        addedGroups.Contains(g.Id) && g.TenantId == s.TenantId && g.Name == u.Group)).ToListAsync(ct));
                    Queue("Опубликован курс", e.Entity.Title, users);
                }
            if (!s.CourseAssigned) continue;
            foreach (var byCourse in links.GroupBy(l => l.CourseId))
            {
                var course = db.ChangeTracker.Entries<Course>().FirstOrDefault(e => e.Entity.Id == byCourse.Key)?.Entity ??
                    await db.Courses.SingleOrDefaultAsync(c => c.Id == byCourse.Key, ct);
                if (course is null || course.DeletedAt != null || course.Status != "published") continue;
                if (s.CoursePublished && courses.Any(e => e.Entity.Id == course.Id)) continue;
                var ids = byCourse.Select(l => l.CohortId).ToArray();
                var users = await db.Accounts.Where(u => u.TenantId == s.TenantId && u.Role == "student" &&
                    db.Cohorts.Any(g => ids.Contains(g.Id) && g.TenantId == s.TenantId && g.Name == u.Group)).ToListAsync(ct);
                Queue("Вам назначен курс", course.Title, users);
            }
        }
    }
}
