using System;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class TrackingAndSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ActivityProgress",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "character varying(100)", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false),
                    ActivityId = table.Column<string>(type: "text", nullable: false),
                    ActivityType = table.Column<string>(type: "text", nullable: false),
                    Coverage = table.Column<int>(type: "integer", nullable: false),
                    ActiveTimeSec = table.Column<int>(type: "integer", nullable: false),
                    Completed = table.Column<bool>(type: "boolean", nullable: false),
                    Seeks = table.Column<int>(type: "integer", nullable: false),
                    Pauses = table.Column<int>(type: "integer", nullable: false),
                    MaxRate = table.Column<double>(type: "double precision", nullable: false),
                    PagesViewed = table.Column<int>(type: "integer", nullable: true),
                    TotalPages = table.Column<int>(type: "integer", nullable: true),
                    DurationSec = table.Column<double>(type: "double precision", nullable: true),
                    Position = table.Column<int>(type: "integer", nullable: true),
                    Sessions = table.Column<int>(type: "integer", nullable: false),
                    LastSessionId = table.Column<string>(type: "text", nullable: false),
                    FirstAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityProgress", x => new { x.UserId, x.CourseId, x.ActivityId });
                    table.ForeignKey(
                        name: "FK_ActivityProgress_Accounts_UserId",
                        column: x => x.UserId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ActivityProgress_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScheduleSlots",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    Group = table.Column<string>(type: "text", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false),
                    Weekday = table.Column<int>(type: "integer", nullable: false),
                    Pair = table.Column<int>(type: "integer", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    Room = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduleSlots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScheduleSlots_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrackingEvents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<string>(type: "character varying(100)", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false),
                    ActivityId = table.Column<string>(type: "text", nullable: false),
                    ActivityType = table.Column<string>(type: "text", nullable: false),
                    SessionId = table.Column<string>(type: "text", nullable: false),
                    Verb = table.Column<string>(type: "text", nullable: false),
                    Position = table.Column<double>(type: "double precision", nullable: true),
                    Payload = table.Column<JsonElement>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrackingEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrackingEvents_Accounts_UserId",
                        column: x => x.UserId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TrackingEvents_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivityProgress_CourseId_ActivityId",
                table: "ActivityProgress",
                columns: new[] { "CourseId", "ActivityId" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleSlots_CourseId",
                table: "ScheduleSlots",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleSlots_TenantId_Group",
                table: "ScheduleSlots",
                columns: new[] { "TenantId", "Group" });

            migrationBuilder.CreateIndex(
                name: "IX_TrackingEvents_CourseId_ActivityId_UserId_At",
                table: "TrackingEvents",
                columns: new[] { "CourseId", "ActivityId", "UserId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_TrackingEvents_CourseId_UserId_At",
                table: "TrackingEvents",
                columns: new[] { "CourseId", "UserId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_TrackingEvents_UserId",
                table: "TrackingEvents",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActivityProgress");

            migrationBuilder.DropTable(
                name: "ScheduleSlots");

            migrationBuilder.DropTable(
                name: "TrackingEvents");
        }
    }
}
