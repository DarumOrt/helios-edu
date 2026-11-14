import type { MetadataRoute } from "next";
import { publicPages, siteUrl } from "@/shared/lib/site-url";

// Адрес сайта известен только при запуске (SITE_URL), а не при сборке образа.
export const dynamic = "force-dynamic";

// Всё, кроме входа и регистрации, закрыто входом — поисковикам там делать нечего.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: [...publicPages], disallow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
