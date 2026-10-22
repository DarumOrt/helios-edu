import "server-only";
import { currentUser } from "@/mocks/current-user";

// Журнал действий: кто, когда и что изменил (управление, оценки, настройки).
// Пока в памяти Next в обоих режимах; в проде — append-only таблица в C#.
export interface AuditEntry {
  id: string;
  at: string;
  actorName: string;
  actorRole: string;
  action: string;
  target: string;
}

const g = globalThis as unknown as { __helios_audit?: AuditEntry[] };
const store: AuditEntry[] = g.__helios_audit ?? (g.__helios_audit = []);

export async function audit(action: string, target: string) {
  const user = await currentUser();
  if (user instanceof Response) return;
  store.push({
    id: `ev-${crypto.randomUUID().slice(0, 8)}`,
    at: new Date().toISOString(),
    actorName: user.name,
    actorRole: user.role,
    action,
    target,
  });
}

/** Для пересланных в C# запросов: пишем в журнал только успешные */
export async function auditIfOk(response: Response, action: string, target: string) {
  if (response.ok) await audit(action, target);
  return response;
}

export const listAudit = () => [...store].reverse();
