namespace HeliosEdu.Api.Courses;

public sealed class CatalogCollection
{
    public string Id { get; set; } = "";
    public string TenantId { get; set; } = "";
    public string Name { get; set; } = "";
    public string NormalizedName { get; set; } = "";
    public List<CatalogCollectionFaculty> Faculties { get; set; } = [];
    public List<CatalogCollectionCourse> Courses { get; set; } = [];
}

public sealed class CatalogCollectionFaculty
{
    public string CollectionId { get; set; } = "";
    public string TenantId { get; set; } = "";
    public string FacultyCode { get; set; } = "";
}

public sealed class CatalogCollectionCourse
{
    public string CollectionId { get; set; } = "";
    public string CourseId { get; set; } = "";
}
