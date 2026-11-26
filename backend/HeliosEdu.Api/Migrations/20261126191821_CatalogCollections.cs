using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HeliosEdu.Api.Migrations
{
    /// <inheritdoc />
    public partial class CatalogCollections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CatalogCollections",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    NormalizedName = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CatalogCollections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CatalogCollectionCourse",
                columns: table => new
                {
                    CollectionId = table.Column<string>(type: "text", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(100)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CatalogCollectionCourse", x => new { x.CollectionId, x.CourseId });
                    table.ForeignKey(
                        name: "FK_CatalogCollectionCourse_CatalogCollections_CollectionId",
                        column: x => x.CollectionId,
                        principalTable: "CatalogCollections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CatalogCollectionCourse_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CatalogCollectionFaculties",
                columns: table => new
                {
                    CollectionId = table.Column<string>(type: "text", nullable: false),
                    FacultyCode = table.Column<string>(type: "text", nullable: false),
                    TenantId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CatalogCollectionFaculties", x => new { x.CollectionId, x.FacultyCode });
                    table.ForeignKey(
                        name: "FK_CatalogCollectionFaculties_CatalogCollections_CollectionId",
                        column: x => x.CollectionId,
                        principalTable: "CatalogCollections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CatalogCollectionFaculties_Faculties_TenantId_FacultyCode",
                        columns: x => new { x.TenantId, x.FacultyCode },
                        principalTable: "Faculties",
                        principalColumns: new[] { "TenantId", "Code" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogCollectionCourse_CourseId",
                table: "CatalogCollectionCourse",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_CatalogCollectionFaculties_TenantId_FacultyCode",
                table: "CatalogCollectionFaculties",
                columns: new[] { "TenantId", "FacultyCode" });

            migrationBuilder.CreateIndex(
                name: "IX_CatalogCollections_TenantId_NormalizedName",
                table: "CatalogCollections",
                columns: new[] { "TenantId", "NormalizedName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CatalogCollectionCourse");

            migrationBuilder.DropTable(
                name: "CatalogCollectionFaculties");

            migrationBuilder.DropTable(
                name: "CatalogCollections");
        }
    }
}
