"use client";

import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Check, ImagePlus, Palette, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui";
import { ApiError } from "@/shared/lib/api-client";
import {
  COVER_COLORS,
  COVER_COLOR_KEYS,
  fallbackCoverColor,
  type CoverColor,
} from "@/shared/lib/cover-colors";
import { cn } from "@/shared/lib/utils";
import type { Course } from "@/shared/types/domain";
import { coursesApi } from "../api";

const MAX_BYTES = 2 * 1024 * 1024;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function errorText(e: unknown) {
  if (e instanceof ApiError && typeof e.details === "string") {
    try {
      return (JSON.parse(e.details) as { error?: string }).error ?? "Не удалось сохранить обложку";
    } catch {
      /* тело ответа не JSON — покажем общее сообщение */
    }
  }
  return "Не удалось сохранить обложку";
}

/** Смена обложки курса: цвет шаблона или своя картинка. Показывать только при can(role, "course.edit"). */
export function CoverEditor({ course }: { course: Course }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { mutate } = useSWRConfig();
  const current = course.coverColor ?? fallbackCoverColor(course.id);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function save(patch: { coverColor?: CoverColor; cover?: string | null }, done: string) {
    setBusy(true);
    try {
      const updated = await coursesApi.updateCover(course.id, patch);
      await mutate(`/api/courses/${course.id}`, updated, { revalidate: false });
      // списки курсов (с модулями и без) — перечитать
      await mutate((key) => typeof key === "string" && key.startsWith("/api/courses?"));
      await mutate("/api/courses");
      toast.success(done);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      toast.error("Подойдёт картинка PNG, JPG или WebP");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Картинка больше 2 МБ — уменьшите её");
      return;
    }
    await save({ cover: await readAsDataUrl(file) }, "Обложка загружена");
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="bg-white/95"
      >
        <Palette size={14} /> Сменить обложку
      </Button>
      {open && (
        <div className="absolute top-10 right-0 z-30 w-72 origin-top-right animate-pop-in rounded-xl bg-card p-4 text-foreground shadow-elevate">
          <div className="text-sm font-medium">Цвет шаблона</div>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {COVER_COLOR_KEYS.map((key) => {
              const active = !course.cover && key === current;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  title={COVER_COLORS[key].label}
                  aria-label={`Цвет «${COVER_COLORS[key].label}»`}
                  aria-pressed={active}
                  onClick={() => save({ coverColor: key, cover: null }, "Цвет обложки изменён")}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-full transition-transform duration-150 ease-out hover:scale-110 active:scale-95",
                    active && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  )}
                  style={{ backgroundColor: COVER_COLORS[key].bg, color: COVER_COLORS[key].shape }}
                >
                  {active && <Check size={14} />}
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-sm font-medium">Своя картинка</div>
          <p className="mt-0.5 text-xs text-muted-foreground">PNG, JPG или WebP до 2 МБ, лучше 1200×400</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImagePlus size={14} /> Загрузить
            </Button>
            {course.cover && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => save({ cover: null }, "Вернули шаблонную обложку")}
              >
                <Trash2 size={14} /> Убрать картинку
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
