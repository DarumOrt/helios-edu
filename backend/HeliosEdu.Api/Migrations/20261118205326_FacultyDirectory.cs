using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class FacultyDirectory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "Courses",
                type: "text",
                nullable: false,
                defaultValue: "pspu");

            migrationBuilder.AddColumn<string[]>(
                name: "OrganizerFaculties",
                table: "Accounts",
                type: "text[]",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Faculties",
                columns: table => new
                {
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    NormalizedCode = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Archived = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Faculties", x => new { x.TenantId, x.Code });
                });

            // Коды остаются ключами ссылок. Сохраняем также факультеты, введённые вручную до миграции.
            migrationBuilder.Sql("""
                UPDATE "Courses" c SET "TenantId" = a."TenantId" FROM "Accounts" a WHERE a."Id" = c."TutorId";
                INSERT INTO "Faculties" ("TenantId","Code","NormalizedCode","Name","Archived") VALUES
                    ('pspu', 'ИНЭК', 'ИНЭК', 'Факультет информатики и экономики', false),
                    ('pspu', 'МФ', 'МФ', 'Математический факультет', false),
                    ('pspu', 'ФизФ', 'ФИЗФ', 'Физический факультет', false),
                    ('pspu', 'ЕНФ', 'ЕНФ', 'Естественнонаучный факультет', false),
                    ('pspu', 'ФФ', 'ФФ', 'Филологический факультет', false),
                    ('pspu', 'ИстФ', 'ИСТФ', 'Исторический факультет', false),
                    ('pspu', 'ИнЯз', 'ИНЯЗ', 'Факультет иностранных языков', false),
                    ('pspu', 'ПсФ', 'ПСФ', 'Факультет психологии', false),
                    ('pspu', 'ПиСПО', 'ПИСПО', 'Факультет правового и социально-педагогического образования', false),
                    ('pspu', 'ПиМНО', 'ПИМНО', 'Факультет педагогики и методики начального образования', false),
                    ('pspu', 'ППД', 'ППД', 'Факультет педагогики и психологии детства', false),
                    ('pspu', 'МузФ', 'МУЗФ', 'Факультет музыки', false),
                    ('pspu', 'ФФК', 'ФФК', 'Факультет физической культуры', false);
                """);
            foreach (var table in new[] { "Accounts", "Cohorts", "Courses" })
            {
                migrationBuilder.Sql($"""
                    UPDATE "{table}" SET "Faculty" = NULL WHERE trim("Faculty") = '';
                    INSERT INTO "Faculties" ("TenantId","Code","NormalizedCode","Name","Archived")
                    SELECT DISTINCT ON (t."TenantId", upper(trim(t."Faculty"))) t."TenantId", trim(t."Faculty"),
                        upper(trim(t."Faculty")), trim(t."Faculty"), false FROM "{table}" t
                    WHERE t."Faculty" IS NOT NULL AND NOT EXISTS
                        (SELECT 1 FROM "Faculties" f WHERE f."TenantId" = t."TenantId" AND f."NormalizedCode" = upper(trim(t."Faculty")))
                    ORDER BY t."TenantId", upper(trim(t."Faculty")), t."Faculty";
                    UPDATE "{table}" t SET "Faculty" = f."Code" FROM "Faculties" f
                    WHERE f."TenantId" = t."TenantId" AND f."NormalizedCode" = upper(trim(t."Faculty"))
                      AND t."Faculty" <> f."Code";
                    """);
            }

            migrationBuilder.CreateIndex(
                name: "IX_Courses_TenantId_Faculty",
                table: "Courses",
                columns: new[] { "TenantId", "Faculty" });

            migrationBuilder.CreateIndex(
                name: "IX_Cohorts_TenantId_Faculty",
                table: "Cohorts",
                columns: new[] { "TenantId", "Faculty" });

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_TenantId_Faculty",
                table: "Accounts",
                columns: new[] { "TenantId", "Faculty" });

            migrationBuilder.CreateIndex(
                name: "IX_Faculties_TenantId_NormalizedCode",
                table: "Faculties",
                columns: new[] { "TenantId", "NormalizedCode" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Accounts_Faculties_TenantId_Faculty",
                table: "Accounts",
                columns: new[] { "TenantId", "Faculty" },
                principalTable: "Faculties",
                principalColumns: new[] { "TenantId", "Code" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Cohorts_Faculties_TenantId_Faculty",
                table: "Cohorts",
                columns: new[] { "TenantId", "Faculty" },
                principalTable: "Faculties",
                principalColumns: new[] { "TenantId", "Code" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Courses_Faculties_TenantId_Faculty",
                table: "Courses",
                columns: new[] { "TenantId", "Faculty" },
                principalTable: "Faculties",
                principalColumns: new[] { "TenantId", "Code" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Accounts_Faculties_TenantId_Faculty",
                table: "Accounts");

            migrationBuilder.DropForeignKey(
                name: "FK_Cohorts_Faculties_TenantId_Faculty",
                table: "Cohorts");

            migrationBuilder.DropForeignKey(
                name: "FK_Courses_Faculties_TenantId_Faculty",
                table: "Courses");

            migrationBuilder.DropTable(
                name: "Faculties");

            migrationBuilder.DropIndex(
                name: "IX_Courses_TenantId_Faculty",
                table: "Courses");

            migrationBuilder.DropIndex(
                name: "IX_Cohorts_TenantId_Faculty",
                table: "Cohorts");

            migrationBuilder.DropIndex(
                name: "IX_Accounts_TenantId_Faculty",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "OrganizerFaculties",
                table: "Accounts");
        }
    }
}
