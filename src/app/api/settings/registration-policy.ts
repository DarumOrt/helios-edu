import "server-only";
import { getSettings } from "@/mocks/settings-store";
import { backendJson } from "@/shared/lib/backend";
import type { SystemSettings } from "@/shared/types/domain";

export async function registrationIsOpen() {
  const settings = await backendJson<SystemSettings>("/api/settings");
  return settings ? settings.ok && settings.data.allowRegistration : getSettings().allowRegistration;
}
