export type { MailSettings, MailCampaign as Campaign } from "@/shared/types/domain";

export const mailStatus: Record<string, string> = {
  queued: "В очереди",
  running: "Выполняется",
  completed: "Завершена",
  partial: "Частично завершена",
  failed: "Ошибка",
  sent: "Принято SMTP",
  sending: "Отправляется",
};
