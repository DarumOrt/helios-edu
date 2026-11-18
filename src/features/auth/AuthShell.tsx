"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { brandingLogo, defaultBranding, useBranding, type Branding } from "@/shared/lib/branding";
import { BrandMark } from "@/shared/ui";
import { FormulaWaves } from "@/shared/ui/FormulaWaves";
import { DataSourceToggle } from "@/shared/layout/DataSourceToggle";
import { ThemeToggle } from "@/shared/layout/ThemeToggle";
import { useDayPart } from "@/shared/lib/use-day-part";
import { cn } from "@/shared/lib/utils";
import type { DataSourceState } from "@/shared/lib/data-source";

// Страницы входа и регистрации. Слева — «волны из формул» (shared/ui/FormulaWaves: небо в светлой теме,
// ночь в тёмной), справа — форма. На узком экране волны становятся полосой над формой.
export function AuthShell({
  dataSource,
  active,
  allowRegistration,
  branding,
  children,
}: {
  dataSource: DataSourceState;
  active: "login" | "register";
  allowRegistration: boolean;
  branding?: Branding;
  children: ReactNode;
}) {
  const day = useDayPart();
  const { data } = useBranding(branding);
  const brand = { ...defaultBranding, ...data };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative isolate flex min-h-52 flex-col overflow-hidden px-6 pt-6 pb-10 text-waves-ink sm:px-10 lg:min-h-screen lg:pt-10 lg:pb-16">
        <FormulaWaves className="-z-10" />
        <Link href="/" className="relative flex w-fit items-center gap-2.5 rounded-md">
          <BrandMark size={30} />
          <span>
            <span className="block text-lg leading-tight font-bold tracking-tight">HeliosEDU</span>
            <span className="block max-w-64 font-mono text-xs wrap-break-word text-waves-ink/70">
              {brand.subtitle}
            </span>
          </span>
        </Link>

        <div className="relative mt-8 max-w-md lg:mt-auto">
          <p className="font-mono text-xs text-waves-ink/70">{day?.dateLabel ?? " "}</p>
          <h2 className="mt-2 animate-enter text-3xl font-bold tracking-tight text-balance lg:text-4xl">
            {day?.greeting ?? "Здравствуйте"}
          </h2>
          <p className="mt-3 text-sm wrap-break-word text-waves-ink/80 lg:text-base">{brand.loginText}</p>
        </div>
      </aside>

      <main className="flex flex-col bg-background px-5 py-6 sm:px-10">
        <div className="flex items-center justify-end gap-1">
          <ThemeToggle />
          <DataSourceToggle state={dataSource} />
        </div>
        <div className="flex flex-1 items-center justify-center py-6 sm:py-10">
          <div className="w-full max-w-md">
            <Image
              src={brandingLogo(brand.logoVersion)}
              alt={brand.logoVersion ? brand.subtitle : "Пермский педагогический"}
              width={256}
              height={96}
              unoptimized
              className="mx-auto mb-4 block h-auto max-h-28 w-56 max-w-full rounded-lg bg-white object-contain sm:w-64"
            />
            {allowRegistration && <AuthTabs active={active} />}
            {children}
          </div>
        </div>
        <p className="text-center text-xs wrap-anywhere text-muted-foreground">{brand.footerText}</p>
      </main>
    </div>
  );
}

function AuthTabs({ active }: { active: "login" | "register" }) {
  const tabs = [
    { key: "login", href: "/login", label: "Вход" },
    { key: "register", href: "/register", label: "Запросить доступ" },
  ] as const;
  return (
    <nav aria-label="Вход или регистрация" className="mb-8 grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "flex h-9 items-center justify-center rounded-sm text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
            active === tab.key
              ? "bg-card text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
