using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class OrganizationBranding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Branding",
                columns: table => new
                {
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    Subtitle = table.Column<string>(type: "text", nullable: true),
                    LoginText = table.Column<string>(type: "text", nullable: true),
                    FooterText = table.Column<string>(type: "text", nullable: true),
                    Logo = table.Column<byte[]>(type: "bytea", nullable: true),
                    LogoType = table.Column<string>(type: "text", nullable: true),
                    LogoVersion = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Branding", x => x.TenantId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Branding");
        }
    }
}
