using System;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdaptiveP5 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AdaptiveEnabled",
                table: "Courses",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "LearningEvents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ActorId = table.Column<string>(type: "text", nullable: false),
                    CourseId = table.Column<string>(type: "text", nullable: false),
                    ActivityId = table.Column<string>(type: "text", nullable: true),
                    SkillId = table.Column<string>(type: "text", nullable: true),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Payload = table.Column<JsonElement>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LearningEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "QuizAttempts",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "character varying(100)", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false),
                    ActivityId = table.Column<string>(type: "text", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Score = table.Column<int>(type: "integer", nullable: true),
                    Max = table.Column<int>(type: "integer", nullable: false),
                    Questions = table.Column<JsonElement>(type: "jsonb", nullable: false),
                    HintCounts = table.Column<JsonElement>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuizAttempts_Accounts_UserId",
                        column: x => x.UserId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_QuizAttempts_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Recommendations",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "character varying(100)", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false),
                    ActivityId = table.Column<string>(type: "text", nullable: true),
                    SkillId = table.Column<string>(type: "text", nullable: true),
                    ReasonCode = table.Column<string>(type: "text", nullable: false),
                    ReasonText = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Recommendations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Recommendations_Accounts_UserId",
                        column: x => x.UserId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Recommendations_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Skills",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false),
                    SectionId = table.Column<string>(type: "text", nullable: true),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    IsAuto = table.Column<bool>(type: "boolean", nullable: false),
                    PInit = table.Column<double>(type: "double precision", nullable: false),
                    PLearn = table.Column<double>(type: "double precision", nullable: false),
                    PSlip = table.Column<double>(type: "double precision", nullable: false),
                    PGuess = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Skills", x => x.Id);
                    table.UniqueConstraint("AK_Skills_CourseId_Id", x => new { x.CourseId, x.Id });
                    table.ForeignKey(
                        name: "FK_Skills_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StudentPins",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "character varying(100)", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false),
                    ActivityId = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentPins", x => new { x.UserId, x.CourseId });
                    table.ForeignKey(
                        name: "FK_StudentPins_Accounts_UserId",
                        column: x => x.UserId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StudentPins_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AttemptAnswers",
                columns: table => new
                {
                    AttemptId = table.Column<string>(type: "text", nullable: false),
                    QuestionId = table.Column<string>(type: "text", nullable: false),
                    Given = table.Column<JsonElement>(type: "jsonb", nullable: false),
                    IsCorrect = table.Column<bool>(type: "boolean", nullable: false),
                    HintsUsed = table.Column<int>(type: "integer", nullable: false),
                    AnsweredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttemptAnswers", x => new { x.AttemptId, x.QuestionId });
                    table.ForeignKey(
                        name: "FK_AttemptAnswers_QuizAttempts_AttemptId",
                        column: x => x.AttemptId,
                        principalTable: "QuizAttempts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ActivitySkills",
                columns: table => new
                {
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false),
                    ActivityId = table.Column<string>(type: "text", nullable: false),
                    SkillId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivitySkills", x => new { x.CourseId, x.ActivityId, x.SkillId });
                    table.ForeignKey(
                        name: "FK_ActivitySkills_Skills_CourseId_SkillId",
                        columns: x => new { x.CourseId, x.SkillId },
                        principalTable: "Skills",
                        principalColumns: new[] { "CourseId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuizQuestions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false),
                    ActivityId = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Options = table.Column<JsonElement>(type: "jsonb", nullable: false),
                    Correct = table.Column<JsonElement>(type: "jsonb", nullable: false),
                    Hints = table.Column<JsonElement>(type: "jsonb", nullable: false),
                    SkillId = table.Column<string>(type: "text", nullable: true),
                    Order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizQuestions", x => new { x.CourseId, x.ActivityId, x.Id });
                    table.ForeignKey(
                        name: "FK_QuizQuestions_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_QuizQuestions_Skills_SkillId",
                        column: x => x.SkillId,
                        principalTable: "Skills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "SkillMastery",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "character varying(100)", nullable: false),
                    SkillId = table.Column<string>(type: "text", nullable: false),
                    PKnown = table.Column<double>(type: "double precision", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    Correct = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    UnlockedByTeacher = table.Column<bool>(type: "boolean", nullable: false),
                    MasteredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkillMastery", x => new { x.UserId, x.SkillId });
                    table.ForeignKey(
                        name: "FK_SkillMastery_Accounts_UserId",
                        column: x => x.UserId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SkillMastery_Skills_SkillId",
                        column: x => x.SkillId,
                        principalTable: "Skills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SkillPrerequisites",
                columns: table => new
                {
                    SkillId = table.Column<string>(type: "text", nullable: false),
                    RequiresSkillId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkillPrerequisites", x => new { x.SkillId, x.RequiresSkillId });
                    table.ForeignKey(
                        name: "FK_SkillPrerequisites_Skills_RequiresSkillId",
                        column: x => x.RequiresSkillId,
                        principalTable: "Skills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SkillPrerequisites_Skills_SkillId",
                        column: x => x.SkillId,
                        principalTable: "Skills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivitySkills_CourseId_SkillId",
                table: "ActivitySkills",
                columns: new[] { "CourseId", "SkillId" });

            migrationBuilder.CreateIndex(
                name: "IX_LearningEvents_CourseId_UserId_At",
                table: "LearningEvents",
                columns: new[] { "CourseId", "UserId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_CourseId",
                table: "QuizAttempts",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_UserId_CourseId_ActivityId",
                table: "QuizAttempts",
                columns: new[] { "UserId", "CourseId", "ActivityId" },
                unique: true,
                filter: "\"SubmittedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_QuizQuestions_SkillId",
                table: "QuizQuestions",
                column: "SkillId");

            migrationBuilder.CreateIndex(
                name: "IX_Recommendations_CourseId",
                table: "Recommendations",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_Recommendations_UserId_CourseId_CreatedAt",
                table: "Recommendations",
                columns: new[] { "UserId", "CourseId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SkillMastery_SkillId",
                table: "SkillMastery",
                column: "SkillId");

            migrationBuilder.CreateIndex(
                name: "IX_SkillPrerequisites_RequiresSkillId",
                table: "SkillPrerequisites",
                column: "RequiresSkillId");

            migrationBuilder.CreateIndex(
                name: "IX_Skills_CourseId_Order",
                table: "Skills",
                columns: new[] { "CourseId", "Order" });

            migrationBuilder.CreateIndex(
                name: "IX_Skills_CourseId_SectionId",
                table: "Skills",
                columns: new[] { "CourseId", "SectionId" },
                unique: true,
                filter: "\"IsAuto\" = TRUE");

            migrationBuilder.CreateIndex(
                name: "IX_StudentPins_CourseId",
                table: "StudentPins",
                column: "CourseId");

            migrationBuilder.Sql("""
                CREATE FUNCTION helios_learning_events_append_only() RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'LearningEvents is append-only: только добавление событий';
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER learning_events_append_only
                    BEFORE UPDATE OR DELETE ON "LearningEvents"
                    FOR EACH ROW EXECUTE FUNCTION helios_learning_events_append_only();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER learning_events_append_only ON "LearningEvents";
                DROP FUNCTION helios_learning_events_append_only();
                """);
            migrationBuilder.DropTable(
                name: "ActivitySkills");

            migrationBuilder.DropTable(
                name: "AttemptAnswers");

            migrationBuilder.DropTable(
                name: "LearningEvents");

            migrationBuilder.DropTable(
                name: "QuizQuestions");

            migrationBuilder.DropTable(
                name: "Recommendations");

            migrationBuilder.DropTable(
                name: "SkillMastery");

            migrationBuilder.DropTable(
                name: "SkillPrerequisites");

            migrationBuilder.DropTable(
                name: "StudentPins");

            migrationBuilder.DropTable(
                name: "QuizAttempts");

            migrationBuilder.DropTable(
                name: "Skills");

            migrationBuilder.DropColumn(
                name: "AdaptiveEnabled",
                table: "Courses");
        }
    }
}
