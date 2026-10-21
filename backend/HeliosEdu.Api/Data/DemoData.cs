using System.Text.Json;
using HeliosEdu.Api.Courses;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Data;

public static class DemoData
{
    public static async Task SeedAsync(LearningDbContext db, CancellationToken cancellationToken)
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
    }
}
