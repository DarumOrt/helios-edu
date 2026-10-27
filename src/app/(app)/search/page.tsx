import { Suspense } from "react";
import { CourseSearch } from "@/features/search/components/CourseSearch";

export const metadata = { title: "Поиск курсов · HeliosEDU" };

// Фильтры читаются из адреса (useSearchParams) — нужен Suspense.
export default function SearchPage() {
  return (
    <Suspense>
      <CourseSearch />
    </Suspense>
  );
}
