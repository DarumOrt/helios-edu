using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Grades;

// Демо-работы и оценки — те же, что src/mocks/submissions-store.ts и gradebook в src/mocks/data.ts.
// Заполняются один раз: если работы уже есть, ничего не трогаем.
public static class GradesSeed
{
    public static async Task SeedAsync(LearningDbContext db, CancellationToken token)
    {
        if (await db.Submissions.AnyAsync(token) || await db.Grades.AnyAsync(token)) return;
        string[] courses = ["c-dor-ai", "c-ai-teaching"];
        if (await db.Courses.CountAsync(course => courses.Contains(course.Id), token) < courses.Length) return;
        var now = DateTimeOffset.UtcNow;
        DateTimeOffset Ago(int days, int hours) => now.AddDays(-days).AddHours(-hours);

        void Work(string id, string courseId, string activityId, string userId, string text, DateTimeOffset at,
            double? grade = null, string? feedback = null)
        {
            db.Submissions.Add(new Submission { Id = id, CourseId = courseId, ActivityId = activityId, UserId = userId,
                Text = text, Status = grade is null ? "submitted" : "reviewed", SubmittedAt = at, Feedback = feedback,
                ReviewedBy = grade is null ? null : "u-tutor-1", ReviewedAt = grade is null ? null : at.AddHours(20) });
            if (grade is { } value) Mark(courseId, activityId, userId, value);
        }

        void Mark(string courseId, string activityId, string userId, double value) =>
            db.Grades.Add(new Grade { CourseId = courseId, ActivityId = activityId, UserId = userId, Value = value,
                GradedBy = courseId == "c-dor-ai" ? "u-tutor-1" : "u-tutor-2", GradedAt = now });

        Work("sub-1", "c-dor-ai", "ma1", "u-stud-1", "Тренажёр по дробям: задания сгенерированы по промптам, ответы проверены вручную.", Ago(1, 6));
        Work("sub-2", "c-dor-ai", "ma1", "u-stud-3", "Квиз по истории Перми: вопросы собраны с помощью нейросети и вычитаны.", Ago(1, 4));
        Work("sub-3", "c-dor-ai", "ma1", "u-stud-5", "Карточки для запоминания терминов, ссылка на ресурс.", Ago(0, 5));
        Work("sub-4", "c-dor-ai", "ma1", "u-stud-6", "Интерактивный тренажёр с обратной связью и отчётом о проверке фактов.", Ago(2, 1),
            88, "Хорошо, но в №4 потеряна область определения.");
        Work("sub-5", "c-ai-teaching", "a5", "u-stud-7", "Эссе о том, как вводить основы ИИ в программы колледжей…", Ago(1, 1));
        Work("sub-6", "c-ai-teaching", "a5", "u-stud-1", "ИИ как инструмент преподавателя и как предмет изучения…", Ago(3, 2),
            90, "Отличная работа, глубокий анализ.");
        Work("sub-7", "c-ai-teaching", "a5", "u-stud-8", "Краткое эссе.", Ago(0, 6));

        // оценки за тесты из журнала демо-режима
        Mark("c-ai-teaching", "a3", "u-stud-1", 85);
        Mark("c-ai-teaching", "a3", "u-stud-2", 73);
        Mark("c-ai-teaching", "a3", "u-stud-3", 95);
        Mark("c-ai-teaching", "a5", "u-stud-2", 90);
        Mark("c-ai-teaching", "a5", "u-stud-3", 88);
        Mark("c-dor-ai", "mq1", "u-stud-1", 95);
        Mark("c-dor-ai", "mq1", "u-stud-3", 88);
        Mark("c-dor-ai", "mq1", "u-stud-6", 82);
        await db.SaveChangesAsync(token);
    }
}
