using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using HeliosEdu.Api.Adaptive;
using HeliosEdu.Api.Grades;
using HeliosEdu.Api.Notifications;

namespace HeliosEdu.Api.Data;

public sealed class LearningDbContext(DbContextOptions<LearningDbContext> options) : DbContext(options)
{
    private void ProtectLearningEvents()
    {
        if (ChangeTracker.Entries<LearningEvent>().Any(entry => entry.State is EntityState.Modified or EntityState.Deleted))
            throw new InvalidOperationException("Журнал обучения допускает только добавление событий.");
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ProtectLearningEvents();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        ProtectLearningEvents();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<LoginSession> LoginSessions => Set<LoginSession>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<Cohort> Cohorts => Set<Cohort>();
    public DbSet<CohortCourse> CohortCourses => Set<CohortCourse>();
    public DbSet<Skill> Skills => Set<Skill>();
    public DbSet<SkillPrerequisite> SkillPrerequisites => Set<SkillPrerequisite>();
    public DbSet<ActivitySkill> ActivitySkills => Set<ActivitySkill>();
    public DbSet<QuizQuestion> QuizQuestions => Set<QuizQuestion>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<AttemptAnswer> AttemptAnswers => Set<AttemptAnswer>();
    public DbSet<LearningEvent> LearningEvents => Set<LearningEvent>();
    public DbSet<SkillMastery> SkillMastery => Set<SkillMastery>();
    public DbSet<Recommendation> Recommendations => Set<Recommendation>();
    public DbSet<StudentPin> StudentPins => Set<StudentPin>();
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<Grade> Grades => Set<Grade>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationRead> NotificationReads => Set<NotificationRead>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ConfigureAdaptive();
        // одна работа на ученика и задание; id материалов уникальны только внутри курса
        modelBuilder.Entity<Submission>().HasIndex(item => new { item.CourseId, item.ActivityId, item.UserId }).IsUnique();
        modelBuilder.Entity<Submission>().HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Submission>().HasOne<Account>().WithMany().HasForeignKey(item => item.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Grade>().HasKey(item => new { item.CourseId, item.ActivityId, item.UserId });
        modelBuilder.Entity<Announcement>().HasIndex(item => new { item.CourseId, item.CreatedAt });
        modelBuilder.Entity<Announcement>().HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Notification>().HasIndex(item => item.UserId);
        modelBuilder.Entity<Notification>().HasOne<Account>().WithMany().HasForeignKey(item => item.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<NotificationRead>().HasKey(item => new { item.UserId, item.NotificationId });
        modelBuilder.Entity<Grade>().HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Grade>().HasOne<Account>().WithMany().HasForeignKey(item => item.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Account>().HasIndex(account => account.NormalizedEmail).IsUnique();
        modelBuilder.Entity<Account>().Property(account => account.Id).HasMaxLength(100);
        modelBuilder.Entity<Account>().Property(account => account.Status).HasDefaultValue("active");
        modelBuilder.Entity<Cohort>().HasIndex(cohort => new { cohort.TenantId, cohort.NormalizedName }).IsUnique();
        modelBuilder.Entity<CohortCourse>().HasKey(link => new { link.CohortId, link.CourseId });
        modelBuilder.Entity<CohortCourse>().HasOne<Cohort>().WithMany().HasForeignKey(link => link.CohortId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<CohortCourse>().HasOne<Course>().WithMany().HasForeignKey(link => link.CourseId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<LoginSession>().HasKey(session => session.TokenHash);
        modelBuilder.Entity<LoginSession>().HasIndex(session => session.ExpiresAt);
        modelBuilder.Entity<LoginSession>().HasOne(session => session.Account).WithMany()
            .HasForeignKey(session => session.AccountId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Enrollment>().HasKey(enrollment => new { enrollment.AccountId, enrollment.CourseId });
        modelBuilder.Entity<Enrollment>().HasOne<Account>().WithMany().HasForeignKey(enrollment => enrollment.AccountId);
        modelBuilder.Entity<Enrollment>().HasOne<Course>().WithMany().HasForeignKey(enrollment => enrollment.CourseId);
        var courses = modelBuilder.Entity<Course>();
        courses.Property(course => course.Id).HasMaxLength(100);
        courses.Property(course => course.Status).HasDefaultValue("published");
        courses.HasIndex(course => course.Code).IsUnique();
        courses.Property<int>("Position");
        // Вложенные коллекции принадлежат курсу; EF хранит их в отдельных таблицах.
        courses.OwnsMany(course => course.Sections, sections =>
        {
            sections.WithOwner().HasForeignKey("CourseId");
            sections.HasKey("CourseId", nameof(Section.Id));
            sections.OwnsMany(section => section.Activities, activities =>
            {
                activities.WithOwner().HasForeignKey("CourseId", "SectionId");
                activities.HasKey("CourseId", "SectionId", nameof(Activity.Id));
                // Порядок материалов задаётся независимо от строкового идентификатора.
                activities.Property<int>("Position");
            });
        });
    }
}
