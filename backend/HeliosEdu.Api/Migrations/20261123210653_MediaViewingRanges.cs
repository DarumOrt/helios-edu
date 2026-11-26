using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class MediaViewingRanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<JsonElement>(
                name: "Media",
                table: "ActivityProgress",
                type: "jsonb",
                nullable: true);
            // Открытые проверочные кабинеты имеют отдельную копию таблиц.
            migrationBuilder.Sql("""
                DO $$
                DECLARE sandbox text;
                BEGIN
                    FOR sandbox IN SELECT schemaname FROM pg_tables
                        WHERE schemaname ~ '^helios_preview_[0-9a-f]{32}$' AND tablename = 'ActivityProgress'
                    LOOP
                        EXECUTE format('ALTER TABLE %I."ActivityProgress" ADD COLUMN IF NOT EXISTS "Media" jsonb', sandbox);
                    END LOOP;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Media",
                table: "ActivityProgress");
            // Открытые проверочные кабинеты имеют отдельную копию таблиц.
            migrationBuilder.Sql("""
                DO $$
                DECLARE sandbox text;
                BEGIN
                    FOR sandbox IN SELECT schemaname FROM pg_tables
                        WHERE schemaname ~ '^helios_preview_[0-9a-f]{32}$' AND tablename = 'ActivityProgress'
                    LOOP
                        EXECUTE format('ALTER TABLE %I."ActivityProgress" DROP COLUMN IF EXISTS "Media"', sandbox);
                    END LOOP;
                END $$;
                """);
        }
    }
}
