using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class ClosedRegistrationDirectory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "Accounts",
                type: "timestamp with time zone",
                nullable: true);

            // При переходе на закрытый доступ приём заявок включается только решением администратора.
            migrationBuilder.Sql("""UPDATE "Settings" SET "AllowRegistration" = FALSE WHERE "AllowRegistration";""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Accounts");
        }
    }
}
