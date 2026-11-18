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
  function organization(variant: LogoTheme) {
    const src = brandingLogo(branding, variant, drafts);
    return src ? (
      <Image
        src={src}
        alt={subtitle}
        width={compact ? 132 : 184}
        height={compact ? 33 : 48}
        unoptimized
        className={cn(
          "block h-auto w-auto max-w-full object-contain object-left",
          compact ? "max-h-8 max-w-33" : "max-h-11 max-w-44 sm:max-h-12 sm:max-w-46",
        )}
      />
    ) : (
      <span className="block max-w-44 text-xs wrap-anywhere opacity-80">{subtitle}</span>
    );
  }

  return (
    <span className={cn("inline-flex max-w-full min-w-0 items-start", compact ? "gap-3" : "gap-3.5")}>
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-xl",
          compact ? "size-10 bg-primary-soft text-primary" : "mt-0.5 size-8",
        )}
      >
        <BrandMark size={compact ? 26 : 30} />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block leading-tight font-bold tracking-tight",
            compact ? "text-lg" : "text-xl sm:text-2xl",
          )}
        >
          HeliosEDU
        </span>
        <span className={cn("mt-1.5 block", compact ? "min-h-7" : "min-h-10")}>
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
    </span>
  );
}
