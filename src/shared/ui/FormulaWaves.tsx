"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";

// «Волны из формул» — фон приветствия и страниц входа (тот же, что в демо-ролике).
// Поле — сумма синусов, изолинии — места, где дробная часть высоты близка к ½ (как горизонтали на карте).
// Цвета — токены --waves-* из globals.css (светлая тема — «небо», тёмная — «ночь»).
// Подробно — docs/design/formula-waves.md.
//
// Один статичный кадр на холсте низкого разрешения, с перерисовкой при смене темы и размера.

/** css-пикселей блока на пиксель холста */
const DOWNSCALE = 3;
/** css-пикселей на единицу поля: чем больше, тем крупнее волны */
const UNIT = 220;
const MAX_SIDE = 640;
const START_T = 7.3;

type Palette = { from: number[]; to: number[]; depth: number[]; line: number[] };

function readPalette(el: Element): Palette {
  const css = getComputedStyle(el);
  const rgb = (name: string, fallback: number[]) => {
    const parts = css.getPropertyValue(name).trim().split(/\s+/).map(Number);
    return parts.length === 3 && parts.every(Number.isFinite) ? parts : fallback;
  };
  return {
    from: rgb("--waves-from", [205, 226, 247]),
    to: rgb("--waves-to", [243, 247, 252]),
    depth: rgb("--waves-depth", [-18, -10, -2]),
    line: rgb("--waves-line", [8, 6, 3]),
  };
}

function draw(canvas: HTMLCanvasElement, img: ImageData, scale: number, t: number, p: Palette) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: W, height: H, data } = img;
  const [f0, f1, f2] = p.from;
  const [t0, t1, t2] = p.to;
  const [d0, d1, d2] = p.depth;
  const [l0, l1, l2] = p.line;
  for (let y = 0; y < H; y++) {
    const v = y * scale;
    const yy = H > 1 ? y / (H - 1) : 0;
    const b0 = f0 + (t0 - f0) * yy;
    const b1 = f1 + (t1 - f1) * yy;
    const b2 = f2 + (t2 - f2) * yy;
    for (let x = 0; x < W; x++) {
      const u = x * scale;
      const w =
        Math.sin(u * 1.25 + t * 0.32) +
        Math.sin(v * 1.8 - t * 0.25 + Math.sin(u * 0.55 + t * 0.1)) +
        Math.sin((u + v) * 0.85 + t * 0.2) +
        0.7 * Math.sin(Math.hypot(u - 3.3, v - 2.6) * 2.3 - t * 0.55);
      const f = Math.abs(((((w * 1.7) % 1) + 1) % 1) - 0.5);
      const line = Math.max(0, 1 - f / 0.055);
      const k = (w + 3.7) / 7.4;
      const i = (y * W + x) * 4;
      data[i] = b0 + d0 * k + l0 * line;
      data[i + 1] = b1 + d1 * k + l1 * line;
      data[i + 2] = b2 + d2 * k + l2 * line;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function FormulaWaves({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const root = document.documentElement;

    let palette = readPalette(root);
    let img: ImageData | null = null;
    let scale = DOWNSCALE / UNIT;

    const render = () => {
      if (img) draw(canvas, img, scale, START_T, palette);
    };

    // Размер холста — по размеру блока, без искажения пропорций
    const resize = () => {
      const { clientWidth: cw, clientHeight: ch } = canvas;
      if (!cw || !ch) return;
      // обычно холст в DOWNSCALE раз меньше блока; на очень больших блоках — не больше MAX_SIDE по стороне
      const down = Math.max(DOWNSCALE, Math.max(cw, ch) / MAX_SIDE);
      const w = Math.max(1, Math.round(cw / down));
      const h = Math.max(1, Math.round(ch / down));
      if (img && img.width === w && img.height === h) return;
      canvas.width = w;
      canvas.height = h;
      img = new ImageData(w, h);
      scale = down / UNIT;
      render();
    };

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    resize();

    // Смена темы: data-theme на <html> (shared/lib/theme.ts)
    const themeObserver = new MutationObserver(() => {
      palette = readPalette(root);
      render();
    });
    themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      sizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full bg-linear-to-b from-[rgb(var(--waves-from))] to-[rgb(var(--waves-to))]",
        className,
      )}
    />
  );
}
