using HeliosEdu.Api.Courses;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Data;

public sealed class LearningDbContext(DbContextOptions<LearningDbContext> options) : DbContext(options)
{
    public DbSet<Course> Courses => Set<Course>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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
