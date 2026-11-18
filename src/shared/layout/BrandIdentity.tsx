import Image from "next/image";
import { BrandMark } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import {
  brandingLogo,
  defaultBranding,
  type Branding,
  type LogoDrafts,
  type LogoTheme,
} from "@/shared/lib/branding";

export function BrandIdentity({
  branding = {},
  compact = false,
  theme,
  drafts,
}: {
  branding?: Branding;
  compact?: boolean;
  theme?: LogoTheme;
  drafts?: LogoDrafts;
}) {
  const subtitle = branding.subtitle ?? defaultBranding.subtitle;
  const scale = (branding.logoScale ?? 100) / 100;
  function organization(variant: LogoTheme) {
    const src = brandingLogo(branding, variant, drafts);
    return src ? (
      <Image
        src={src}
        alt={subtitle}
        width={compact ? 132 : 184}
        height={compact ? 33 : 48}
        unoptimized
        style={{ width: (compact ? 132 : 184) * scale, maxHeight: (compact ? 34 : 48) * scale }}
        className="block h-auto max-w-full object-contain object-left"
      />
    ) : (
      <span className="block max-w-44 text-xs wrap-anywhere opacity-80">{subtitle}</span>
    );
  }

  return (
    <span className="flex max-w-full min-w-0 flex-col items-start gap-1.5">
      <span className={cn("flex items-center", compact ? "gap-3" : "gap-3.5")}>
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-xl",
            compact ? "size-10 bg-primary-soft text-primary" : "size-8",
          )}
        >
          <BrandMark size={compact ? 26 : 30} />
        </span>
        <span
          className={cn(
            "leading-tight font-bold tracking-tight",
            compact ? "text-lg" : "text-xl sm:text-2xl",
          )}
        >
          HeliosEDU
        </span>
      </span>
      <span className="block max-w-full">
        {theme ? (
          organization(theme)
        ) : (
          <>
            <span className="block [[data-theme=dark]_&]:hidden">{organization("light")}</span>
            <span className="hidden [[data-theme=dark]_&]:block">{organization("dark")}</span>
          </>
        )}
      </span>
    </span>
  );
}
