import { NextResponse } from "next/server";
import { getSettings, updateSettings, type SystemSettings } from "@/mocks/settings-store";
import { demoActorWith, fail, readJson } from "@/mocks/management-guards";
import { audit } from "@/mocks/audit-store";
import { getDataSource } from "@/shared/lib/backend";

const LABELS: Record<keyof SystemSettings, string> = {
  allowRegistration: "Открытая регистрация студентов",
  announcementsEnabled: "Объявления преподавателей",
};

export async function GET() {
  return NextResponse.json(getSettings());
}

// PUT { allowRegistration?, announcementsEnabled? } — только администратор (system.manage)
export async function PUT(req: Request) {
  if ((await getDataSource()).source === "demo") {
    const actor = await demoActorWith("system.manage");
    if (actor instanceof NextResponse) return actor;
  }
  const body = await readJson(req);
  if (!body) return fail(400, "Некорректный запрос");
  const patch: Partial<SystemSettings> = {};
  for (const key of Object.keys(LABELS) as (keyof SystemSettings)[]) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean")
      return fail(400, "Проверьте поля формы", { [key]: "Ожидается да или нет" });
    patch[key] = body[key];
  }
  const before = getSettings();
  const after = updateSettings(patch);
  for (const key of Object.keys(patch) as (keyof SystemSettings)[])
    if (before[key] !== after[key]) await audit(after[key] ? "Включено" : "Выключено", LABELS[key]);
  return NextResponse.json(after);
}
