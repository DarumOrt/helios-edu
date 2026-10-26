using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class PspuGroupsAndCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AcademicYear",
                table: "Courses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Faculty",
                table: "Courses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Direction",
                table: "Cohorts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DirectionCode",
                table: "Cohorts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Level",
                table: "Cohorts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Profile",
                table: "Cohorts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Year",
                table: "Cohorts",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AcademicYear",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "Faculty",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "Direction",
                table: "Cohorts");

            migrationBuilder.DropColumn(
                name: "DirectionCode",
                table: "Cohorts");

            migrationBuilder.DropColumn(
                name: "Level",
                table: "Cohorts");

            migrationBuilder.DropColumn(
                name: "Profile",
                table: "Cohorts");

            migrationBuilder.DropColumn(
                name: "Year",
                table: "Cohorts");
        }
    }
}
