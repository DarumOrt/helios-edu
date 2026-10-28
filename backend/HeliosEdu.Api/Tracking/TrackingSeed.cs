using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Tracking;

/// <summary>
/// Демо-данные (Database:SeedDemoData): правдоподобный прогресс группы М1227 по курсу c-dor-ai — как в моках
/// (src/mocks/tracking-store.ts), но без случайностей, — и недельное расписание группы. Повторный запуск ничего не меняет.
/// </summary>
public static class TrackingSeed
{
    // профили вовлечённости: покрытие видео %, слайдов из 14, страниц из 8, результат теста %
    private static readonly Dictionary<string, (int Video, int Slides, int Pages, int Quiz)> Profiles = new()
    {
        ["u-stud-1"] = (100, 14, 8, 95), ["u-stud-3"] = (96, 13, 8, 88), ["u-stud-5"] = (74, 9, 6, 70),
        ["u-stud-6"] = (88, 12, 7, 82), ["u-stud-7"] = (40, 5, 3, 55), ["u-stud-8"] = (62, 10, 4, 64),
        ["u-stud-9"] = (91, 13, 8, 86), ["u-stud-10"] = (55, 6, 5, 61), ["u-stud-11"] = (100, 14, 8, 92),
        ["u-stud-12"] = (33, 4, 2, 48), ["u-stud-13"] = (80, 11, 6, 77), ["u-stud-14"] = (68, 9, 5, 72),
        ["u-stud-15"] = (85, 12, 7, 80), ["u-stud-16"] = (47, 6, 3, 58), ["u-stud-17"] = (93, 14, 8, 90),
    };

    private static readonly (string Id, string CourseId, int Weekday, int Pair, string Kind, string Room)[] Schedule =
    [
        ("sl1", "c-project-mgmt", 2, 6, "lecture", "IV к. А202"), ("sl2", "c-project-mgmt", 2, 7, "practice", "IV к. А202"),
        ("sl3", "c-project-mgmt", 2, 8, "practice", "онлайн"), ("sl4", "c-dor-ai", 3, 6, "lecture", "IV к. А304"),
        ("sl5", "c-dor-ai", 3, 7, "practice", "IV к. А304"), ("sl6", "c-edu-data", 4, 6, "lecture", "IV к. А204"),
        ("sl7", "c-edu-data", 4, 7, "practice", "IV к. А204"), ("sl8", "c-edu-data", 4, 8, "practice", "онлайн"),
        ("sl9", "c-ai-teaching", 5, 6, "lecture", "IV к. А220"), ("sl10", "c-ai-teaching", 5, 7, "practice", "IV к. А220"),
        ("sl11", "c-ai-teaching", 5, 8, "practice", "онлайн"),
    ];

    public static async Task SeedAsync(LearningDbContext db, CancellationToken token)
    {
        if (!await db.ScheduleSlots.AnyAsync(token))
            db.ScheduleSlots.AddRange(Schedule.Select(slot => new ScheduleSlot
            {
                Id = slot.Id, TenantId = "pspu", Group = "М1227", CourseId = slot.CourseId, Weekday = slot.Weekday,
                Pair = slot.Pair, Kind = slot.Kind, Room = slot.Room,
            }));

        if (!await db.ActivityProgress.AnyAsync(token) && await db.Courses.AnyAsync(course => course.Id == "c-dor-ai", token))
        {
            var existing = await db.Accounts.Where(account => Profiles.Keys.Contains(account.Id) || account.Id == "u-stud-2")
                .Select(account => account.Id).ToListAsync(token);
            var now = DateTimeOffset.UtcNow;
            var index = 0;
            foreach (var (userId, p) in Profiles.Where(pair => existing.Contains(pair.Key)))
            {
                // «давность» — от номера ученика, чтобы данные были разными, но одинаковыми при каждом запуске
                var ago = TimeSpan.FromHours(6 + 7 * (index++ % 10));
                db.ActivityProgress.AddRange(
                    Row(userId, "mv1", "video", p.Video, p.Video * 7, p.Video >= 90, now - ago, durationSec: 720),
                    Row(userId, "mp1", "presentation", (int)Math.Round(p.Slides / 14d * 100), p.Slides * 25, p.Slides / 14d >= 0.8,
                        now - ago - TimeSpan.FromHours(20), pages: p.Slides, total: 14),
                    Row(userId, "md1", "pdf", (int)Math.Round(p.Pages / 8d * 100), p.Pages * 30, p.Pages / 8d >= 0.8,
                        now - ago - TimeSpan.FromHours(30), pages: p.Pages, total: 8),
                    Row(userId, "mq1", "quiz", p.Quiz, 200 + p.Quiz * 3, true, now - ago - TimeSpan.FromHours(10)));
            }
            // текущий демо-студент (Вагулин) — только начал конспект, остальное наберёт сам
            if (existing.Contains("u-stud-2"))
                db.ActivityProgress.Add(Row("u-stud-2", "md1", "pdf", 50, 120, false, now.AddDays(-1), pages: 4, total: 8));
        }
        await db.SaveChangesAsync(token);
    }

    private static ActivityProgress Row(string userId, string activityId, string type, int coverage, int activeTime,
        bool completed, DateTimeOffset at, double? durationSec = null, int? pages = null, int? total = null) => new()
    {
        UserId = userId, CourseId = "c-dor-ai", ActivityId = activityId, ActivityType = type, Coverage = coverage,
        ActiveTimeSec = activeTime, Completed = completed, PagesViewed = pages, TotalPages = total, DurationSec = durationSec,
        LastSessionId = "seed", FirstAt = at, LastAt = at,
    };
}
