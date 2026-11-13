/** Чтение только заголовка для сопоставления колонок; полную проверку выполняет C# API. */
export function csvHeaders(text: string): string[] {
  const first = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const count = (separator: string) => {
    let quoted = false;
    let result = 0;
    for (const char of first) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === separator) result++;
    }
    return result;
  };
  const delimiter = count(";") > count(",") ? ";" : ",";
  const result: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < first.length; i++) {
    const char = first[i];
    if (char === '"') {
      if (quoted && first[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      result.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  result.push(cell.trim());
  return result;
}

/** Формулы из недоверенных данных не должны выполняться при открытии отчёта в Excel. */
export function downloadCsv(name: string, rows: (string | number | undefined | null)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
        })
        .join(";"),
    )
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
