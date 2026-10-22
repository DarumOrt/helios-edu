import {
  ClipboardCheck,
  FileDown,
  FileText,
  MessagesSquare,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { ActivityType } from "@/shared/types/domain";

// Иконка и подпись типа материала — одни для страницы курса и конструктора
export const activityIcon: Record<ActivityType, LucideIcon> = {
  quiz: ClipboardCheck,
  assignment: FileText,
  file: FileDown,
  forum: MessagesSquare,
  page: FileText,
  video: Video,
  pdf: FileText,
  presentation: Presentation,
};

export const activityLabel: Record<ActivityType, string> = {
  quiz: "Тест",
  assignment: "Задание",
  file: "Файл",
  forum: "Форум",
  page: "Страница",
  video: "Видеолекция",
  pdf: "Конспект (PDF)",
  presentation: "Презентация",
};

/** ISO → значение для <input type="datetime-local"> в местном времени */
export function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local (местное время) → ISO с часовым поясом; пусто → null */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
