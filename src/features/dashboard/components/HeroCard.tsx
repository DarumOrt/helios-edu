"use client";

import { useSessionStore } from "@/stores/session-store";
import { Button } from "@/shared/ui";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

export function HeroCard() {
  const user = useSessionStore((s) => s.user);
  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-soft">
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "linear-gradient(135deg, hsl(222 70% 28%) 0%, hsl(250 70% 38%) 100%), url('https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1600&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundBlendMode: "overlay",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 300px at 100% 0%, rgba(255,255,255,0.18), transparent), linear-gradient(180deg, rgba(15,23,42,0.05), rgba(15,23,42,0.55))",
        }}
      />
      <div className="relative px-8 py-10 text-white">
        <div className="text-xs uppercase tracking-[0.18em] opacity-80">
          {user.faculty}
          {user.group ? ` · группа ${user.group}` : ""}
        </div>
        <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
          {greeting}, {user.name.split(" ")[0]}
        </h2>
        <p className="mt-2 text-sm text-white/80 max-w-lg">
          Сегодня у вас открыто несколько активностей. Продолжите обучение там, где остановились.
        </p>
        <div className="mt-5 flex gap-2">
          <Link href="/courses">
            <Button variant="primary" className="bg-white text-primary hover:bg-white/90 shadow-elevate">
              <BookOpen size={16} />
              К курсам
            </Button>
          </Link>
          <Link href="/gradebook">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              Журнал оценок
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
