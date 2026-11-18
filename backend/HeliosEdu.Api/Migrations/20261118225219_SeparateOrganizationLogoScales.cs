using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeparateOrganizationLogoScales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MenuLogoScale",
                table: "Branding",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Branding" SET "MenuLogoScale" = "LogoScale" WHERE "LogoScale" IS NOT NULL
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MenuLogoScale",
                table: "Branding");
        }
    }
}
