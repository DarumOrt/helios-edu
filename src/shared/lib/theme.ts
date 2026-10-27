// Тема интерфейса: «светлая», «тёмная» или «как в системе». Выбор хранится в localStorage,
// применяется атрибутом data-theme на <html> (токены — globals.css). Без хранилища — как в системе.
export type ThemePreference = "light" | "dark" | "system";

export const THEME_KEY = "helios-theme";

const isPreference = (v: unknown): v is ThemePreference => v === "light" || v === "dark" || v === "system";

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function apply(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && systemDark());
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

// Подписка для useSyncExternalStore: выбор в этой вкладке, в других вкладках и смена темы системы.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    apply(readPreference());
    listener();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return;
    apply(readPreference());
    listener();
  };
  media.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

export const getThemePreference = readPreference;
export const getServerThemePreference = (): ThemePreference => "system";

export function setThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // приватный режим: тема действует до перезагрузки
  }
  apply(pref);
  notify();
}

/** Ставит data-theme до первой отрисовки, чтобы тёмная тема не «мигала» светлой. Вставляется в <head>. */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;
