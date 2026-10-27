using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class StudentProgressAndDueDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Enrolled",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "Progress",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "Completed",
                table: "Activity");

            // Строку «2026-11-12T00:00:00.000Z» PostgreSQL сам не приводит к дате: преобразуем явно, пустую — в NULL.
            migrationBuilder.Sql("""
                ALTER TABLE "Activity" ALTER COLUMN "Due" TYPE timestamp with time zone
                USING NULLIF(btrim("Due"), '')::timestamp with time zone;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Enrolled",
                table: "Courses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Progress",
                table: "Courses",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql("""
                ALTER TABLE "Activity" ALTER COLUMN "Due" TYPE text
                USING to_char("Due" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
                """);

            migrationBuilder.AddColumn<bool>(
                name: "Completed",
                table: "Activity",
                type: "boolean",
                nullable: true);
        }
    }
}
