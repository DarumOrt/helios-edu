"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";

// «Волны из формул» — фон приветствия и страниц входа (тот же, что в демо-ролике).
// Поле — сумма синусов, изолинии — места, где дробная часть высоты близка к ½ (как горизонтали на карте).
// Цвета — токены --waves-* из globals.css (светлая тема — «небо», тёмная — «ночь»).
// Подробно — docs/design/formula-waves.md.

/** css-пикселей блока на пиксель холста */
const DOWNSCALE = 3;
/** css-пикселей на единицу поля: чем больше, тем крупнее волны */
const UNIT = 220;
const MAX_SIDE = 640;
const START_T = 7.3;
const PHASE_PER_MS = 0.00025;
const MAX_FRAME_GAP_MS = 50;

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

function createField(width: number, height: number, scale: number) {
  const radialSin = new Float32Array(width * height);
  const radialCos = new Float32Array(width * height);
  // Пространственная часть радиальной волны зависит только от размеров.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      const angle = Math.hypot(x * scale - 3.3, y * scale - 2.6) * 2.3;
      radialSin[pixel] = Math.sin(angle);
      radialCos[pixel] = Math.cos(angle);
    }
  }
  return {
    img: new ImageData(width, height),
    scale,
    radialSin,
    radialCos,
    levels: new Float32Array(width * height),
    horizontal: new Float64Array(width),
    verticalSin: new Float64Array(width),
    verticalCos: new Float64Array(width),
    diagonalSin: new Float64Array(width),
    diagonalCos: new Float64Array(width),
  };
}

function draw(ctx: CanvasRenderingContext2D, field: ReturnType<typeof createField>, t: number, p: Palette) {
  const {
    img,
    scale,
    radialSin,
    radialCos,
    levels,
    horizontal,
    verticalSin,
    verticalCos,
    diagonalSin,
    diagonalCos,
  } = field;
  const { width, height, data } = img;
  const radialTimeSin = 0.7 * Math.sin(-t * 0.55);
  const radialTimeCos = 0.7 * Math.cos(-t * 0.55);

  // sin(a + b) позволяет вынести тригонометрию из цикла по пикселям.
  for (let x = 0; x < width; x++) {
    const u = x * scale;
    const vertical = Math.sin(u * 0.55 + t * 0.1);
    const diagonal = u * 0.85 + t * 0.2;
    horizontal[x] = Math.sin(u * 1.25 + t * 0.32);
    verticalSin[x] = Math.sin(vertical);
    verticalCos[x] = Math.cos(vertical);
    diagonalSin[x] = Math.sin(diagonal);
    diagonalCos[x] = Math.cos(diagonal);
  }
  for (let y = 0; y < height; y++) {
    const v = y * scale;
    const vertical = v * 1.8 - t * 0.25;
    const diagonal = v * 0.85;
    const vs = Math.sin(vertical);
    const vc = Math.cos(vertical);
    const ds = Math.sin(diagonal);
    const dc = Math.cos(diagonal);
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const w =
        horizontal[x] +
        vs * verticalCos[x] +
        vc * verticalSin[x] +
        ds * diagonalCos[x] +
        dc * diagonalSin[x] +
        radialSin[i] * radialTimeCos +
        radialCos[i] * radialTimeSin;
      levels[i] = w * 1.7;
    }
  }

  const [f0, f1, f2] = p.from;
  const [t0, t1, t2] = p.to;
  const [d0, d1, d2] = p.depth;
  const [l0, l1, l2] = p.line;
  for (let y = 0; y < height; y++) {
    const yy = height > 1 ? y / (height - 1) : 0;
    const b0 = f0 + (t0 - f0) * yy;
    const b1 = f1 + (t1 - f1) * yy;
    const b2 = f2 + (t2 - f2) * yy;
    const row = y * width;
    const adjacentRow = y < height - 1 ? row + width : Math.max(0, row - width);
    for (let x = 0; x < width; x++) {
      const pixel = row + x;
      const level = levels[pixel];
      const f = Math.abs(level - Math.floor(level) - 0.5);
      const adjacentX = x < width - 1 ? x + 1 : Math.max(0, x - 1);
      // У крутой линии засвечиваем соседние выборки слабее, чтобы штрих не распадался на «лесенку».
      const footprint = Math.abs(levels[row + adjacentX] - level) + Math.abs(levels[adjacentRow + x] - level);
      const halfWidth = Math.max(0.055, footprint);
      const line = Math.max(0, 1 - f / halfWidth) * (0.055 / halfWidth);
      const k = (level / 1.7 + 3.7) / 7.4;
      const i = pixel * 4;
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let palette = readPalette(root);
    let field: ReturnType<typeof createField> | undefined;

    let phase = START_T;
    let inView = false;
    let frame: number | undefined;
    let lastFrame: number | undefined;

    const render = () => {
      if (field) draw(ctx, field, phase, palette);
    };

    const animate = (now: number) => {
      if (lastFrame !== undefined) {
        phase += Math.min(now - lastFrame, MAX_FRAME_GAP_MS) * PHASE_PER_MS;
        render();
      }
      lastFrame = now;
      frame = window.requestAnimationFrame(animate);
    };

    const stop = () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = undefined;
      lastFrame = undefined;
    };

    const updateAnimation = () => {
      if (reducedMotion.matches || document.hidden || !inView) {
        stop();
      } else if (frame === undefined) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    // Размер холста — по размеру блока, без искажения пропорций
    const resize = () => {
      const { clientWidth: cw, clientHeight: ch } = canvas;
      if (!cw || !ch) return;
      // обычно холст в DOWNSCALE раз меньше блока; на очень больших блоках — не больше MAX_SIDE по стороне
      const down = Math.max(DOWNSCALE, Math.max(cw, ch) / MAX_SIDE);
      const w = Math.max(1, Math.round(cw / down));
      const h = Math.max(1, Math.round(ch / down));
      const nextScale = down / UNIT;
      if (field?.img.width === w && field.img.height === h && field.scale === nextScale) return;
      canvas.width = w;
      canvas.height = h;
      field = createField(w, h, nextScale);
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

    const viewObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updateAnimation();
    });
    viewObserver.observe(canvas);
    document.addEventListener("visibilitychange", updateAnimation);
    reducedMotion.addEventListener("change", updateAnimation);

    return () => {
      stop();
      viewObserver.disconnect();
      document.removeEventListener("visibilitychange", updateAnimation);
      reducedMotion.removeEventListener("change", updateAnimation);
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
