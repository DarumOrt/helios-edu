// Источник данных: демонстрационные моки или C# API. Общие константы для сервера, proxy и клиента.
export type DataSource = "demo" | "server";

export const DATA_SOURCE_COOKIE = "helios-data-source";

export interface DataSourceState {
  source: DataSource;
  /** C# API подключён (задан BACKEND_API_URL) */
  serverAvailable: boolean;
  /** демо-режим не отключён (DEMO_MODE=off) */
  demoAllowed: boolean;
}

// Без BACKEND_API_URL доступен только демо-режим. С ним по умолчанию — сервер,
// демо включается явно cookie и только если не запрещено DEMO_MODE=off.
export function resolveDataSource(cookieValue: string | undefined): DataSourceState {
  const serverAvailable = Boolean(process.env.BACKEND_API_URL);
  const demoAllowed = process.env.DEMO_MODE !== "off";
  const source: DataSource = !serverAvailable || (cookieValue === "demo" && demoAllowed) ? "demo" : "server";
  return { source, serverAvailable, demoAllowed };
}
