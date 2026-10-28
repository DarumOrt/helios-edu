import "server-only";
import { getDemoActor } from "@/mocks/demo-actor";
import { AUDIT_ACTIONS, type AuditAction } from "@/shared/lib/audit-labels";
import type { AuditChange, AuditEntry, AuditPage } from "@/shared/types/domain";

// Журнал действий демо-режима — тот же формат и фильтры, что у C# (Audit/AuditEndpoints.cs).
// В режиме «Сервер» журнал пишет и отдаёт C#, Next сам ничего не записывает.

const g = globalThis as unknown as { __helios_audit2?: { seq: number; items: AuditEntry[] } };
const store = g.__helios_audit2 ?? (g.__helios_audit2 = { seq: 0, items: [] });

export async function audit(action: AuditAction, target: string, changes?: AuditChange[]) {
  const actor = await getDemoActor();
  const [actionText, category] = AUDIT_ACTIONS[action];
  store.items.push({
    id: ++store.seq,
    at: new Date().toISOString(),
    actorName: actor.name,
    actorRole: actor.role,
    action,
    actionText,
    category,
    targetType: action.split(".")[0],
    target,
    ...(changes?.length ? { changes } : {}),
  });
}

/** Изменённые поля: только те, что поменялись (как AuditLog.Diff в C#) */
export const diff = (...fields: [field: string, before?: string | null, after?: string | null][]) =>
  fields
    .filter(([, before, after]) => (before ?? "") !== (after ?? ""))
    .map(([field, before, after]) => ({
      field,
      ...(before ? { before } : {}),
      ...(after ? { after } : {}),
    }));

export interface AuditFilter {
  from?: string | null;
  to?: string | null;
  category?: string | null;
  role?: string | null;
  q?: string | null;
  cursor?: number | null;
  limit?: number | null;
}

/** Страница журнала: новее → старее, по 50, фильтры как в C# */
export function listAudit(f: AuditFilter = {}): AuditPage {
  const q = f.q?.trim().toLowerCase();
  const rows = [...store.items]
    .reverse()
    .filter(
      (e) =>
        (!f.from || e.at.slice(0, 10) >= f.from) &&
        (!f.to || e.at.slice(0, 10) <= f.to) &&
        (!f.category || e.category === f.category) &&
        (!f.role || e.actorRole === f.role) &&
        (!q || [e.actorName, e.target, e.actionText].some((s) => s.toLowerCase().includes(q))) &&
        (!f.cursor || e.id < f.cursor),
    );
  const size = Math.min(Math.max(f.limit ?? 50, 1), 200);
  const items = rows.slice(0, size);
  return rows.length > size ? { items, nextCursor: items[items.length - 1].id } : { items };
}
