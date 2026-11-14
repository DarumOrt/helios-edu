import type { MetadataRoute } from "next";
import { publicPages, siteUrl } from "@/shared/lib/site-url";

// Адрес сайта известен только при запуске (SITE_URL), а не при сборке образа.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map((path) => ({ url: `${siteUrl()}${path}`, changeFrequency: "monthly" }));
}
