using HeliosEdu.Api.Courses;
using HeliosEdu.Api.Auth;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Data;

public sealed class LearningDbContext(DbContextOptions<LearningDbContext> options) : DbContext(options)
{
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<LoginSession> LoginSessions => Set<LoginSession>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Account>().HasIndex(account => account.NormalizedEmail).IsUnique();
        modelBuilder.Entity<Account>().Property(account => account.Id).HasMaxLength(100);
        modelBuilder.Entity<LoginSession>().HasKey(session => session.TokenHash);
        modelBuilder.Entity<LoginSession>().HasIndex(session => session.ExpiresAt);
        modelBuilder.Entity<LoginSession>().HasOne(session => session.Account).WithMany()
            .HasForeignKey(session => session.AccountId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Enrollment>().HasKey(enrollment => new { enrollment.AccountId, enrollment.CourseId });
        modelBuilder.Entity<Enrollment>().HasOne<Account>().WithMany().HasForeignKey(enrollment => enrollment.AccountId);
        modelBuilder.Entity<Enrollment>().HasOne<Course>().WithMany().HasForeignKey(enrollment => enrollment.CourseId);
        var courses = modelBuilder.Entity<Course>();
        courses.Property(course => course.Id).HasMaxLength(100);
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
