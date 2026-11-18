using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class ThemedOrganizationLogos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "DarkLogo",
                table: "Branding",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DarkLogoType",
                table: "Branding",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DarkLogoVersion",
                table: "Branding",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UseLogo",
                table: "Branding",
                type: "boolean",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Branding" SET "UseLogo" = FALSE
                WHERE "Subtitle" IS NOT NULL AND "LogoVersion" IS NULL
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DarkLogo",
                table: "Branding");

            migrationBuilder.DropColumn(
                name: "DarkLogoType",
                table: "Branding");

            migrationBuilder.DropColumn(
                name: "DarkLogoVersion",
                table: "Branding");

            migrationBuilder.DropColumn(
                name: "UseLogo",
                table: "Branding");
        }
    }
}
