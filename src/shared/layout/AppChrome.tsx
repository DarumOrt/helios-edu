"use client";

import type { ReactNode } from "react";
import { useMaterialView } from "@/shared/lib/material-view";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { PasswordReminder } from "./PasswordReminder";

export function AppChrome({ children }: { children: ReactNode }) {
  const standalone = useMaterialView();
  if (standalone) return <main className="min-h-dvh min-w-0 flex-1 p-3 sm:p-4">{children}</main>;

  return (
    <>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <PasswordReminder />
          {children}
        </main>
      </div>
    </>
  );
}
