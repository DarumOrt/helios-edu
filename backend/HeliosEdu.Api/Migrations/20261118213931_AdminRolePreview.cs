using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdminRolePreview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PreviewId",
                table: "LoginSessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviewRole",
                table: "LoginSessions",
                type: "text",
                nullable: true);

            migrationBuilder.Sql("""
                CREATE FUNCTION drop_role_preview() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
                BEGIN
                    IF TG_OP = 'DELETE' OR NEW."PreviewId" IS DISTINCT FROM OLD."PreviewId" THEN
                        EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', 'helios_preview_' || replace(OLD."PreviewId"::text, '-', ''));
                    END IF;
                    RETURN NULL;
                END $$;
                CREATE TRIGGER drop_role_preview AFTER UPDATE OF "PreviewId" OR DELETE ON "LoginSessions"
                    FOR EACH ROW WHEN (OLD."PreviewId" IS NOT NULL) EXECUTE FUNCTION drop_role_preview();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "LoginSessions" SET "PreviewId" = NULL, "PreviewRole" = NULL WHERE "PreviewId" IS NOT NULL;
                DROP TRIGGER drop_role_preview ON "LoginSessions";
                DROP FUNCTION drop_role_preview();
                """);
            migrationBuilder.DropColumn(
                name: "PreviewId",
                table: "LoginSessions");

            migrationBuilder.DropColumn(
                name: "PreviewRole",
                table: "LoginSessions");
        }
    }
}
