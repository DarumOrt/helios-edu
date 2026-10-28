using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class SettingsAndAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditLog",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    ActorId = table.Column<string>(type: "text", nullable: true),
                    ActorName = table.Column<string>(type: "text", nullable: false),
                    ActorRole = table.Column<string>(type: "text", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    TargetType = table.Column<string>(type: "text", nullable: false),
                    TargetId = table.Column<string>(type: "text", nullable: true),
                    TargetName = table.Column<string>(type: "text", nullable: false),
                    Changes = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLog", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Settings",
                columns: table => new
                {
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    AllowRegistration = table.Column<bool>(type: "boolean", nullable: false),
                    AnnouncementsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Settings", x => x.TenantId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLog_TenantId_At",
                table: "AuditLog",
                columns: new[] { "TenantId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLog_TenantId_Id",
                table: "AuditLog",
                columns: new[] { "TenantId", "Id" });

            // журнал действий — только добавление, как LearningEvents
            migrationBuilder.Sql("""
                CREATE FUNCTION helios_audit_log_append_only() RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'AuditLog is append-only: журнал действий допускает только добавление';
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER audit_log_append_only
                    BEFORE UPDATE OR DELETE ON "AuditLog"
                    FOR EACH ROW EXECUTE FUNCTION helios_audit_log_append_only();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER audit_log_append_only ON "AuditLog";
                DROP FUNCTION helios_audit_log_append_only();
                """);
            migrationBuilder.DropTable(
                name: "AuditLog");

            migrationBuilder.DropTable(
                name: "Settings");
        }
    }
}
