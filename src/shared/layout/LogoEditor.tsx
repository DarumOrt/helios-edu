"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/shared/ui";
import { FormError } from "@/shared/ui/form-submit";
import { type LogoTheme } from "@/shared/lib/branding";

const edges = [
  ["Слева", "left", "right"],
  ["Справа", "right", "left"],
  ["Сверху", "top", "bottom"],
  ["Снизу", "bottom", "top"],
] as const;
const emptyCrop = { left: 0, right: 0, top: 0, bottom: 0 };

function cropLogo(image: HTMLImageElement, crop: typeof emptyCrop) {
  const { naturalWidth: width, naturalHeight: height } = image;
  const w = (width * (100 - crop.left - crop.right)) / 100;
  const h = (height * (100 - crop.top - crop.bottom)) / 100;
  const scale = Math.min(1, 512 / w, 224 / h);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(
    image,
    (width * crop.left) / 100,
    (height * crop.top) / 100,
    w,
    h,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL("image/png");
}

export function LogoEditor({
  theme,
  removable,
  setReading,
  error,
  onChange,
}: {
  theme: LogoTheme;
  removable: boolean;
  setReading: (reading: boolean) => void;
  error?: string;
  onChange: (value: string | null) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement>();
  const [crop, setCrop] = useState(emptyCrop);
  const [localError, setError] = useState("");
  const title = theme === "dark" ? "Логотип для тёмной темы" : "Логотип для светлой темы";

  async function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Выберите PNG, JPEG или WebP до 8 МБ");
      return;
    }
    setError("");
    setReading(true);
    const url = URL.createObjectURL(file);
    try {
      const source = new window.Image();
      source.src = url;
      await source.decode();
      const data = cropLogo(source, emptyCrop);
      setImage(source);
      setCrop(emptyCrop);
      onChange(data);
    } catch {
      setError("Не удалось открыть изображение");
    } finally {
      URL.revokeObjectURL(url);
      setReading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <label className="block text-sm font-medium">
        {title}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="mt-2 block w-full min-w-0 cursor-pointer overflow-hidden text-xs file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1.5 file:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => void selectLogo(event)}
        />
      </label>
      <FormError message={localError || error || ""} />
      {image && (
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium">Обрезка по краям</legend>
          {edges.map(([label, edge, opposite]) => (
            <label
              key={edge}
              className="grid grid-cols-[4.25rem_minmax(0,1fr)_2rem] items-center gap-1 text-xs"
            >
              <span>{label}</span>
              <input
                type="range"
                min={0}
                max={95 - crop[opposite]}
                value={crop[edge]}
                className="w-full accent-primary"
                onChange={(event) => {
                  const next = { ...crop, [edge]: event.target.valueAsNumber };
                  onChange(cropLogo(image, next));
                  setCrop(next);
                }}
              />
              <span>{crop[edge]}%</span>
            </label>
          ))}
        </fieldset>
      )}
      {removable && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setImage(undefined);
            setError("");
            onChange(null);
          }}
        >
          Убрать изображение
        </Button>
      )}
    </div>
  );
}
