using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class CourseBuilderP2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Старые демосроки содержали только дату; Date.parse в Next трактует её как полночь UTC.
            migrationBuilder.Sql("""
                UPDATE "Activity" SET "Due" = "Due" || 'T00:00:00.000Z'
                WHERE "Due" ~ '^\d{4}-\d{2}-\d{2}$';
                """);
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Activity",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxGrade",
                table: "Activity",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "Activity");

            migrationBuilder.DropColumn(
                name: "MaxGrade",
                table: "Activity");
        }
    }
}
