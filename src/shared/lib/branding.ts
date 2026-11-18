import useSWR from "swr";
import pspuLogo from "@/shared/assets/pspu-logo.png";
import pspuLogoDark from "@/shared/assets/pspu-logo-dark.png";
import { fetcher } from "@/shared/lib/api-client";

export const brandingPath = "/api/branding";

export type Branding = Partial<
  Record<"subtitle" | "loginText" | "footerText" | "logoVersion" | "darkLogoVersion", string>
> & { useLogo?: boolean; logoScale?: number };
export type LogoTheme = "light" | "dark";
export type LogoDrafts = Partial<Record<LogoTheme, string | null>>;

export function usesLogo(branding: Branding) {
  return branding.useLogo ?? true;
}

export function brandingLogo(branding: Branding, theme: LogoTheme, drafts?: LogoDrafts) {
  if (!usesLogo(branding)) return null;
  const version = theme === "dark" ? branding.darkLogoVersion : branding.logoVersion;
  if (drafts?.[theme]) return drafts[theme];
  if (drafts?.[theme] !== null && version)
    return "/api/branding/logo?" + new URLSearchParams({ theme, v: version });
  if (
    branding.useLogo === undefined &&
    !branding.logoVersion &&
    !branding.darkLogoVersion &&
    !drafts?.light &&
    !drafts?.dark
  )
    return theme === "dark" ? pspuLogoDark.src : pspuLogo.src;
  return null;
}

export const defaultBranding = {
  subtitle: "ПГГПУ",
  loginText: "Курсы, задания и оценки в одном месте. Сразу видно, что уже сделано и с чего продолжить.",
  footerText: "Электронная образовательная среда ПГГПУ · учебный проект",
};

export function useBranding(initial?: Branding) {
  return useSWR<Branding>(brandingPath, fetcher, { fallbackData: initial });
}
