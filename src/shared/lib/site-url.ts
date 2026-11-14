// Публичный адрес сайта для robots.txt, sitemap.xml и ссылок в метаданных.
// На рабочем сервере приходит из SITE_URL (compose.prod.yaml), локально — адрес разработки.
export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Страницы, открытые без входа: только их разрешаем поисковикам и перечисляем в карте сайта */
export const publicPages = ["/login", "/register"] as const;
