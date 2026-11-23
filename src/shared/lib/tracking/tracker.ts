"use client";

import { previewHeaders } from "@/shared/lib/api-client";

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
    if (typeof document !== "undefined" && document.querySelector("[data-helios-inspection]")) return;
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
      if (useBeacon && !previewHeaders()["X-Helios-Preview"] && navigator.sendBeacon) {
        navigator.sendBeacon("/api/tracking/events", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/tracking/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...previewHeaders() },
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
    if (typeof document !== "undefined" && document.querySelector("[data-helios-inspection]")) return;
    const body = JSON.stringify(snapshot);
    if (
      useBeacon &&
      !previewHeaders()["X-Helios-Preview"] &&
      typeof navigator !== "undefined" &&
      navigator.sendBeacon
    ) {
      navigator.sendBeacon("/api/tracking/progress", new Blob([body], { type: "application/json" }));
      return;
    }
    return fetch("/api/tracking/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...previewHeaders() },
      body,
      keepalive: true,
    })
      .then((response) => response.ok)
      .catch(() => false);
  }
}

export const tracker = new Tracker();

export function newSessionId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
