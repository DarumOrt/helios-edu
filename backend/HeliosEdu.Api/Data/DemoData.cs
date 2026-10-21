using System.Text.Json;
using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Data;

public static class DemoData
{
    public static async Task SeedAsync(LearningDbContext db, IConfiguration configuration, CancellationToken cancellationToken)
    {
        // Заполнение запускается явно и никогда не перезаписывает существующие курсы.
        await using var stream = File.OpenRead(Path.Combine(AppContext.BaseDirectory, "Data", "courses.json"));
        var courses = await JsonSerializer.DeserializeAsync<List<Course>>(
            stream, new JsonSerializerOptions(JsonSerializerDefaults.Web), cancellationToken)
            ?? throw new InvalidOperationException("Не удалось прочитать демонстрационные курсы.");

        var existingIds = await db.Courses.Select(course => course.Id).ToListAsync(cancellationToken);
        foreach (var (course, coursePosition) in courses.Select((course, index) => (course, index)))
        {
            if (existingIds.Contains(course.Id)) continue;
            db.Courses.Add(course);
            db.Entry(course).Property("Position").CurrentValue = coursePosition;
            foreach (var section in course.Sections)
            {
                for (var position = 0; position < section.Activities.Count; position++)
                    db.Entry(section.Activities[position]).Property("Position").CurrentValue = position;
            }
        }
        await db.SaveChangesAsync(cancellationToken);

        var password = configuration["Auth:DemoPassword"];
        if (string.IsNullOrEmpty(password))
            throw new InvalidOperationException("Для демоаккаунтов задайте Auth__DemoPassword.");
        await using var usersStream = File.OpenRead(Path.Combine(AppContext.BaseDirectory, "Data", "users.json"));
        var accounts = await JsonSerializer.DeserializeAsync<List<Account>>(
            usersStream, new JsonSerializerOptions(JsonSerializerDefaults.Web), cancellationToken)
            ?? throw new InvalidOperationException("Не удалось прочитать демонстрационных пользователей.");
        var hasher = new PasswordHasher<Account>();
        var existingAccounts = await db.Accounts.Select(account => account.Id).ToListAsync(cancellationToken);
        var existingEnrollments = await db.Enrollments.ToListAsync(cancellationToken);
        foreach (var account in accounts.Where(account => !existingAccounts.Contains(account.Id)))
        {
            account.NormalizedEmail = account.Email.Trim().ToUpperInvariant();
            account.PasswordHash = hasher.HashPassword(account, password);
            db.Accounts.Add(account);
            if (account.Role != "student") continue;
            foreach (var course in courses)
                if (!existingEnrollments.Any(enrollment => enrollment.AccountId == account.Id && enrollment.CourseId == course.Id))
                    db.Enrollments.Add(new Enrollment { AccountId = account.Id, CourseId = course.Id });
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}
