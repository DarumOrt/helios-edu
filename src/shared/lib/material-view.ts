"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function useMaterialView() {
  const pathname = usePathname();
  const params = useSearchParams();
  return /^\/courses\/[^/]+\/(video|document)\/[^/]+$/.test(pathname) && params.get("view") === "material";
}
