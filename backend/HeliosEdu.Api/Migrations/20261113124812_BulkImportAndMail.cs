using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class BulkImportAndMail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccountActivation",
                columns: table => new
                {
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    AccountId = table.Column<string>(type: "character varying(100)", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountActivation", x => x.TokenHash);
                    table.ForeignKey(
                        name: "FK_AccountActivation_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MailCampaign",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    RequestId = table.Column<string>(type: "text", nullable: false),
                    Fingerprint = table.Column<string>(type: "text", nullable: false),
                    Subject = table.Column<string>(type: "text", nullable: false),
                    Body = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MailCampaign", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MailSettings",
                columns: table => new
                {
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    Host = table.Column<string>(type: "text", nullable: false),
                    Port = table.Column<int>(type: "integer", nullable: false),
                    Security = table.Column<string>(type: "text", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: false),
                    Secret = table.Column<string>(type: "text", nullable: false),
                    FromEmail = table.Column<string>(type: "text", nullable: false),
                    FromName = table.Column<string>(type: "text", nullable: false),
                    UserCreated = table.Column<bool>(type: "boolean", nullable: false),
                    Invitation = table.Column<bool>(type: "boolean", nullable: false),
                    CourseAssigned = table.Column<bool>(type: "boolean", nullable: false),
                    GroupAdded = table.Column<bool>(type: "boolean", nullable: false),
                    CoursePublished = table.Column<bool>(type: "boolean", nullable: false),
                    ConnectionState = table.Column<string>(type: "text", nullable: true),
                    CheckedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MailSettings", x => x.TenantId);
                });

            migrationBuilder.CreateTable(
                name: "UserImport",
                columns: table => new
                {
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    RequestId = table.Column<string>(type: "text", nullable: false),
                    Fingerprint = table.Column<string>(type: "text", nullable: false),
                    Report = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserImport", x => new { x.TenantId, x.RequestId });
                });

            migrationBuilder.CreateTable(
                name: "MailRecipient",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    CampaignId = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    NextAttemptAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Error = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MailRecipient", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MailRecipient_MailCampaign_CampaignId",
                        column: x => x.CampaignId,
                        principalTable: "MailCampaign",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccountActivation_AccountId",
                table: "AccountActivation",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_MailCampaign_TenantId_RequestId",
                table: "MailCampaign",
                columns: new[] { "TenantId", "RequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MailRecipient_CampaignId_Email",
                table: "MailRecipient",
                columns: new[] { "CampaignId", "Email" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MailRecipient_Status_NextAttemptAt",
                table: "MailRecipient",
                columns: new[] { "Status", "NextAttemptAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccountActivation");

            migrationBuilder.DropTable(
                name: "MailRecipient");

            migrationBuilder.DropTable(
                name: "MailSettings");

            migrationBuilder.DropTable(
                name: "UserImport");

            migrationBuilder.DropTable(
                name: "MailCampaign");
        }
    }
}
