// Даты демо-данных считаются от момента запуска сервера, чтобы сроки не «протухали»:
// часть заданий всегда впереди, одно — просрочено, события — в последние дни.
const DAY = 24 * 60 * 60 * 1000;
const startedAt = Date.now();

/** Срок задания: дата `YYYY-MM-DD` через `days` дней (отрицательное — в прошлом). */
export function dueInDays(days: number): string {
  return new Date(startedAt + days * DAY).toISOString().slice(0, 10);
}

/** Момент события `days` дней и `hours` часов назад, ISO-строка. */
export function daysAgo(days: number, hours = 0): string {
  return new Date(startedAt - days * DAY - hours * 60 * 60 * 1000).toISOString();
}

/** «20 мая» — для текстов уведомлений. */
export function dayMonth(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
}
