import type { Metadata } from "next";
import { Golos_Text, JetBrains_Mono, Literata } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import { themeInitScript } from "@/shared/lib/theme";
import "./globals.css";

// Интерфейс — Golos Text (родная кириллица), коды/баллы/время — JetBrains Mono, материалы для чтения — Literata.
const golos = Golos_Text({
  subsets: ["latin", "cyrillic"],
  variable: "--font-golos",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains",
  display: "swap",
});

const literata = Literata({
  subsets: ["latin", "cyrillic"],
  variable: "--font-literata",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HeliosEDU",
  description: "Электронная образовательная среда ПГГПУ (мокап)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme ставит скрипт до отрисовки — атрибут на сервере и в браузере отличается намеренно
    <html
      lang="ru"
      className={`${golos.variable} ${jetbrains.variable} ${literata.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
