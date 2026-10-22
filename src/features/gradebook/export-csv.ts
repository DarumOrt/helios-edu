import { api } from "@/shared/lib/api-client";
import type { GradeRow } from "@/shared/types/domain";

// Экспорт журнала в CSV для Excel: разделитель «;» и BOM — иначе русский Excel ломает кириллицу и столбцы.
const cell = (v: string | number | null) => {
  const s = v == null ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function exportGradebookCsv(courseId: string, courseCode: string) {
  const rows = await api.get<GradeRow[]>(`/api/gradebook?courseId=${encodeURIComponent(courseId)}`);
  const items = rows[0]?.items ?? [];
  const lines = [
    ["Студент", ...items.map((i) => `${i.itemTitle} (из ${i.max})`), "Итог"],
    ...rows.map((r) => [r.userName, ...r.items.map((i) => i.grade), r.total]),
  ].map((line) => line.map(cell).join(";"));

  const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `журнал-${courseCode}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
