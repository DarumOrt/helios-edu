import { CatalogPreview } from "@/features/search/components/CatalogPreview";

export default async function CatalogCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CatalogPreview courseId={courseId} />;
}
