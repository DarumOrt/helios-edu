using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Courses;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Adaptive;

public static class AdaptiveModelConfiguration
{
    public static void ConfigureAdaptive(this ModelBuilder model)
    {
        var skills = model.Entity<Skill>();
        skills.ToTable("Skills");
        skills.HasKey(item => item.Id);
        skills.HasAlternateKey(item => new { item.CourseId, item.Id });
        skills.Property(item => item.Title).HasMaxLength(200);
        skills.Property(item => item.Code).HasMaxLength(20);
        skills.Property(item => item.Description).HasMaxLength(1000);
        skills.HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId).OnDelete(DeleteBehavior.Restrict);
        skills.HasIndex(item => new { item.CourseId, item.Order });
        // Один авто-навык модуля; ручных навыков может быть несколько.
        skills.HasIndex(item => new { item.CourseId, item.SectionId }).IsUnique().HasFilter("\"IsAuto\" = TRUE");
        var prerequisites = model.Entity<SkillPrerequisite>();
        prerequisites.ToTable("SkillPrerequisites");
        prerequisites.HasKey(item => new { item.SkillId, item.RequiresSkillId });
        prerequisites.HasOne<Skill>().WithMany().HasForeignKey(item => item.SkillId).OnDelete(DeleteBehavior.Cascade);
        prerequisites.HasOne<Skill>().WithMany().HasForeignKey(item => item.RequiresSkillId).OnDelete(DeleteBehavior.Cascade);
        var links = model.Entity<ActivitySkill>();
        links.ToTable("ActivitySkills");
        links.HasKey(item => new { item.CourseId, item.ActivityId, item.SkillId });
        links.HasOne<Skill>().WithMany().HasForeignKey(item => new { item.CourseId, item.SkillId })
            .HasPrincipalKey(item => new { item.CourseId, item.Id }).OnDelete(DeleteBehavior.Cascade);
        var questions = model.Entity<QuizQuestion>();
        questions.ToTable("QuizQuestions");
        questions.HasKey(item => new { item.CourseId, item.ActivityId, item.Id });
        questions.Property(item => item.Text).HasMaxLength(2000);
        questions.Property(item => item.Options).HasColumnType("jsonb");
        questions.Property(item => item.Correct).HasColumnType("jsonb");
        questions.Property(item => item.Hints).HasColumnType("jsonb");
        questions.HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId).OnDelete(DeleteBehavior.Restrict);
        questions.HasOne<Skill>().WithMany().HasForeignKey(item => item.SkillId).OnDelete(DeleteBehavior.SetNull);
        var attempts = model.Entity<QuizAttempt>();
        attempts.ToTable("QuizAttempts");
        attempts.Property(item => item.Questions).HasColumnType("jsonb");
        attempts.Property(item => item.HintCounts).HasColumnType("jsonb");
        attempts.HasIndex(item => new { item.UserId, item.CourseId, item.ActivityId }).IsUnique().HasFilter("\"SubmittedAt\" IS NULL");
        attempts.HasOne<Account>().WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Restrict);
        attempts.HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId).OnDelete(DeleteBehavior.Restrict);
        var answers = model.Entity<AttemptAnswer>();
        answers.ToTable("AttemptAnswers");
        answers.HasKey(item => new { item.AttemptId, item.QuestionId });
        answers.Property(item => item.Given).HasColumnType("jsonb");
        answers.HasOne<QuizAttempt>().WithMany().HasForeignKey(item => item.AttemptId).OnDelete(DeleteBehavior.Restrict);
        var events = model.Entity<LearningEvent>();
        events.ToTable("LearningEvents");
        events.Property(item => item.Id).ValueGeneratedOnAdd();
        events.Property(item => item.Payload).HasColumnType("jsonb");
        events.HasIndex(item => new { item.CourseId, item.UserId, item.At });
        // Ссылки в журнале логические: удаление сущности не переписывает историю события.
        var mastery = model.Entity<SkillMastery>();
        mastery.ToTable("SkillMastery");
        mastery.HasKey(item => new { item.UserId, item.SkillId });
        mastery.HasOne<Skill>().WithMany().HasForeignKey(item => item.SkillId).OnDelete(DeleteBehavior.Restrict);
        mastery.HasOne<Account>().WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Restrict);
        var recommendations = model.Entity<Recommendation>();
        recommendations.ToTable("Recommendations");
        recommendations.HasIndex(item => new { item.UserId, item.CourseId, item.CreatedAt });
        recommendations.HasOne<Account>().WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Restrict);
        recommendations.HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId).OnDelete(DeleteBehavior.Restrict);
        var pins = model.Entity<StudentPin>();
        pins.ToTable("StudentPins");
        pins.HasKey(item => new { item.UserId, item.CourseId });
        pins.HasOne<Account>().WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Restrict);
        pins.HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<Course>().Property(item => item.AdaptiveEnabled).HasDefaultValue(true);
    }
}
