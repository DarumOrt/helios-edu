// Настройки системы (раздел администратора). Пока в памяти Next в обоих режимах.
export interface SystemSettings {
  /** студенты могут сами создать учётную запись на /register */
  allowRegistration: boolean;
  /** преподаватели могут отправлять объявления курсу */
  announcementsEnabled: boolean;
}

const g = globalThis as unknown as { __helios_settings?: SystemSettings };
const settings: SystemSettings =
  g.__helios_settings ?? (g.__helios_settings = { allowRegistration: true, announcementsEnabled: true });

export const getSettings = (): SystemSettings => ({ ...settings });
export function updateSettings(patch: Partial<SystemSettings>) {
  Object.assign(settings, patch);
  return getSettings();
}
