"use client";

import type { TrackingEvent, ProgressSnapshot } from "./types";

/** Событие от плеера: курс обязателен — id материалов уникальны только внутри курса */
export type TrackedEvent = Omit<TrackingEvent, "id" | "ts"> & { courseId: string };
type Queued = TrackingEvent & { courseId: string };

// Клиентский трекер-синглтон.
// - Батчит дискретные события и флашит по интервалу + через sendBeacon на закрытие вкладки
//   (иначе теряются события при unload — критично для "закрыл вкладку на середине").
// - Снимки прогресса шлёт отдельным каналом.

const FLUSH_INTERVAL_MS = 5000;

class Tracker {
  private queue: Queued[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private bound = false;

  private ensure() {
    if (this.bound || typeof window === "undefined") return;
    this.bound = true;
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.flush(true);
    });
    window.addEventListener("pagehide", () => this.flush(true));
  }

  event(e: TrackedEvent) {
    this.ensure();
    this.queue.push({ ...e, id: crypto.randomUUID(), ts: Date.now() });
  }

  flush(useBeacon = false) {
    if (this.queue.length === 0) return;
    const all = this.queue;
    this.queue = [];
    // одна отправка — один курс: { courseId, events }
    for (const courseId of new Set(all.map((e) => e.courseId)))
      this.send(
        courseId,
        all.filter((e) => e.courseId === courseId),
        useBeacon,
      );
  }

  private send(courseId: string, batch: Queued[], useBeacon: boolean) {
    const body = JSON.stringify({ courseId, events: batch.map(({ courseId: _course, ...event }) => event) });
    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/tracking/events", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/tracking/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {
          // при ошибке возвращаем события в очередь
          this.queue.unshift(...batch);
        });
      }
    } catch {
      this.queue.unshift(...batch);
    }
  }

  // Снимок прогресса — отдельно, чтобы агрегат на сервере обновлялся даже без флаша очереди.
  progress(snapshot: ProgressSnapshot & { courseId: string }, useBeacon = false) {
    const body = JSON.stringify(snapshot);
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/tracking/progress", new Blob([body], { type: "application/json" }));
      return;
    }
    fetch("/api/tracking/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

export const tracker = new Tracker();

export function newSessionId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
