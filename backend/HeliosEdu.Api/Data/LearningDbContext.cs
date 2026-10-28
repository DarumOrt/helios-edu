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
        if (ChangeTracker.Entries<Audit.AuditEntry>().Any(entry => entry.State is EntityState.Modified or EntityState.Deleted))
            throw new InvalidOperationException("Журнал действий допускает только добавление записей.");
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
    private static readonly System.Text.Json.JsonSerializerOptions AuditJson = new(System.Text.Json.JsonSerializerDefaults.Web);
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<LoginSession> LoginSessions => Set<LoginSession>();
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
    public DbSet<Files.StoredFile> Files => Set<Files.StoredFile>();
    public DbSet<Audit.SystemSettings> Settings => Set<Audit.SystemSettings>();
    public DbSet<Audit.AuditEntry> AuditLog => Set<Audit.AuditEntry>();
    public DbSet<Tracking.ActivityProgress> ActivityProgress => Set<Tracking.ActivityProgress>();
    public DbSet<Tracking.TrackingEvent> TrackingEvents => Set<Tracking.TrackingEvent>();
    public DbSet<Tracking.ScheduleSlot> ScheduleSlots => Set<Tracking.ScheduleSlot>();

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
        // прогресс — один на ученика и материал курса (id материалов уникальны только внутри курса)
        var progress = modelBuilder.Entity<Tracking.ActivityProgress>();
        progress.HasKey(item => new { item.UserId, item.CourseId, item.ActivityId });
        progress.HasIndex(item => new { item.CourseId, item.ActivityId });
        progress.HasOne<Account>().WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Cascade);
        progress.HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId).OnDelete(DeleteBehavior.Cascade);
        var tracking = modelBuilder.Entity<Tracking.TrackingEvent>();
        tracking.Property(item => item.Id).UseIdentityAlwaysColumn();
        tracking.Property(item => item.Payload).HasColumnType("jsonb");
        tracking.HasIndex(item => new { item.CourseId, item.ActivityId, item.UserId, item.At });
        tracking.HasIndex(item => new { item.CourseId, item.UserId, item.At });
        tracking.HasOne<Account>().WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Cascade);
        tracking.HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId).OnDelete(DeleteBehavior.Cascade);
        var schedule = modelBuilder.Entity<Tracking.ScheduleSlot>();
        schedule.HasIndex(item => new { item.TenantId, item.Group });
        schedule.HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Audit.SystemSettings>().ToTable("Settings").HasKey(item => item.TenantId);
        var audit = modelBuilder.Entity<Audit.AuditEntry>();
        audit.ToTable("AuditLog");
        audit.Property(item => item.Id).UseIdentityAlwaysColumn();
        audit.HasIndex(item => new { item.TenantId, item.Id });
        audit.HasIndex(item => new { item.TenantId, item.At });
        audit.Property(item => item.Changes).HasColumnType("jsonb").HasConversion(
            value => value == null ? null : System.Text.Json.JsonSerializer.Serialize(value, AuditJson),
            value => value == null ? null : System.Text.Json.JsonSerializer.Deserialize<List<Audit.AuditChange>>(value, AuditJson),
            new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<List<Audit.AuditChange>?>(
                (left, right) => (left == null && right == null) || (left != null && right != null && left.SequenceEqual(right)),
                value => value == null ? 0 : value.Count,
                value => value == null ? null : value.ToList()));
        var files = modelBuilder.Entity<Files.StoredFile>();
        files.ToTable("Files");
        files.Ignore(file => file.Url);
        files.Property(file => file.Id).HasMaxLength(40);
        files.Property(file => file.Kind).HasMaxLength(20);
        files.Property(file => file.Status).HasMaxLength(20);
        files.Property(file => file.FileName).HasMaxLength(200);
        files.Property(file => file.ContentType).HasMaxLength(120);
        files.Property(file => file.ObjectKey).HasMaxLength(300);
        files.HasIndex(file => file.Status);
        files.HasOne<Course>().WithMany().HasForeignKey(file => file.CourseId).OnDelete(DeleteBehavior.Cascade);
        files.HasOne<Account>().WithMany().HasForeignKey(file => file.OwnerId).OnDelete(DeleteBehavior.Cascade);
        // файл сданной работы не удаляется, пока есть работа (FileJanitor его и не трогает)
        modelBuilder.Entity<Submission>().HasOne<Files.StoredFile>().WithMany().HasForeignKey(item => item.FileId)
            .OnDelete(DeleteBehavior.Restrict);
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
