import useSWR from "swr";
import pspuLogo from "@/shared/assets/pspu-logo.png";
import { fetcher } from "@/shared/lib/api-client";

export const brandingPath = "/api/branding";

export type Branding = Partial<Record<"subtitle" | "loginText" | "footerText" | "logoVersion", string>>;

export const defaultBranding = {
  subtitle: "ПГГПУ",
  loginText: "Курсы, задания и оценки в одном месте. Сразу видно, что уже сделано и с чего продолжить.",
  footerText: "Электронная образовательная среда ПГГПУ · учебный проект",
};

export function useBranding(initial?: Branding) {
  return useSWR<Branding>(brandingPath, fetcher, { fallbackData: initial });
}

export function brandingLogo(version?: string) {
  return version ? "/api/branding/logo?v=" + encodeURIComponent(version) : pspuLogo.src;
}
