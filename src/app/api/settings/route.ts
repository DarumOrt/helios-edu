import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/mocks/settings-store";
import { demoActorWith, fail, readJson } from "@/mocks/management-guards";
import { audit, diff } from "@/mocks/audit-store";
import { backendForward } from "@/shared/lib/backend";
import type { SystemSettings } from "@/shared/types/domain";

// Настройки системы. Сервер — C# (Audit/AuditEndpoints.cs: читать могут все, менять — администратор),
// демо — моки ниже с теми же правилами и текстами.
const LABELS: Record<keyof SystemSettings, string> = {
  allowRegistration: "Открытая регистрация студентов",
  announcementsEnabled: "Объявления преподавателей",
};
const yesNo = (v: boolean) => (v ? "да" : "нет");

export async function GET(req: Request) {
  const forwarded = await backendForward(req, "/api/settings");
  return forwarded ?? NextResponse.json(getSettings());
}

// PUT { allowRegistration?, announcementsEnabled? } — неизвестные поля и не да/нет — 400
export async function PUT(req: Request) {
  const forwarded = await backendForward(req, "/api/settings");
  if (forwarded) return forwarded;
  const actor = await demoActorWith("system.manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(body))
    if (!(key in LABELS)) fields[key] = "Неизвестная настройка";
    else if (typeof value !== "boolean") fields[key] = "Ожидается да или нет";
  if (Object.keys(fields).length) return fail(400, "Проверьте поля формы", fields);
  const before = getSettings();
  const after = updateSettings(body as Partial<SystemSettings>);
  const changes = diff(
    ...(Object.keys(LABELS) as (keyof SystemSettings)[]).map(
      (key) => [LABELS[key], yesNo(before[key]), yesNo(after[key])] as [string, string, string],
    ),
  );
  if (changes.length) await audit("settings.updated", "Настройки системы", changes);
  return NextResponse.json(after);
}
