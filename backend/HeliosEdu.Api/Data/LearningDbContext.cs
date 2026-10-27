using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Auth;
using HeliosEdu.Api.Management;
using Microsoft.EntityFrameworkCore;
using HeliosEdu.Api.Adaptive;

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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ConfigureAdaptive();
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
