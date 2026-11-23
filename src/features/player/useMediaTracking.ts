"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { useSession } from "@/shared/auth/session";
import { fetcher } from "@/shared/lib/api-client";
import { mediaProgress, union } from "@/shared/lib/tracking/media";
import { newSessionId, tracker } from "@/shared/lib/tracking/tracker";
import type { ActivityProgress, ProgressSnapshot, TrackingVerb } from "@/shared/lib/tracking/types";

export function useMediaTracking(
  courseId: string,
  activityId: string,
  activityType: "pdf" | "presentation" | "video",
  onViewed?: () => void,
  onComplete?: (coverage: number) => void,
) {
  const user = useSession((s) => s.user);
  const [sessionId] = useState(newSessionId);
  const { data: prior, error } = useSWR<ActivityProgress | null>(
    `/api/tracking/progress?${new URLSearchParams({ courseId, activityId, userId: user.id, sessionId })}`,
    fetcher,
    { refreshInterval: 5000, dedupingInterval: 500 },
  );
  const [draft, setDraft] = useState<ProgressSnapshot>(() => ({
    sessionId,
    userId: user.id,
    activityId,
    activityType,
    coverage: 0,
    completed: false,
    activeTimeSec: 0,
    media: { watched: [], active: [], positionAt: 0 },
    ts: 0,
  }));
  const latest = useRef(draft);
  const sent = useRef(0);
  const opened = useRef(false);
  const notified = useRef(false);
  const stats = mediaProgress(prior, draft);

  function event(verb: TrackingVerb, position?: number, payload?: Record<string, unknown>) {
    tracker.event({
      courseId,
      sessionId,
      userId: user.id,
      activityId,
      activityType,
      verb,
      position,
      payload,
    });
  }

  function record(
    fields: Partial<
      Pick<ProgressSnapshot, "position" | "totalPages" | "durationSec" | "pauses" | "seeks" | "maxRate">
    >,
    watched?: number[],
    active?: number[],
  ) {
    if (prior === undefined || !isActiveTab()) return;
    if (watched && !opened.current) {
      opened.current = true;
      event("opened");
      onViewed?.();
    }
    const prev = latest.current;
    const ts = Date.now();
    const media = prev.media!;
    const next = {
      ...prev,
      ...fields,
      ts,
      media: {
        watched: watched ? union(media.watched, [watched]) : media.watched,
        active: active ? union(media.active, [active]) : media.active,
        positionAt: fields.position == null ? media.positionAt : ts,
      },
    };
    latest.current = next;
    setDraft(next);
    const progress = mediaProgress(prior, next);
    if (!prior?.completed && !notified.current && progress.completed) {
      notified.current = true;
      event("completed", next.position);
      onComplete?.(progress.coverage);
      toast.success("Материал засчитан", { description: `Просмотрено ${progress.coverage}%` });
    }
  }

  function saveNow(beacon = false) {
    const current = latest.current;
    if (!current.ts || sent.current >= current.ts) return;
    const pending = tracker.progress({ ...current, courseId }, beacon);
    if (pending)
      return pending.then((ok) => {
        if (ok) sent.current = Math.max(sent.current, current.ts);
      });
  }
  const save = useEffectEvent(saveNow);

  useEffect(() => {
    const id = setInterval(() => save(), 4000);
    const flush = () => save(true);
    const hide = () => {
      if (document.hidden) flush();
    };
    window.addEventListener("blur", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(id);
      window.removeEventListener("blur", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hide);
      flush();
      if (opened.current) {
        tracker.event({ courseId, sessionId, userId: user.id, activityId, activityType, verb: "closed" });
        tracker.flush(true);
      }
    };
  }, [courseId, sessionId, user.id, activityId, activityType]);

  return { prior, error, readyToView: prior !== undefined || Boolean(error), record, event, stats, saveNow };
}

export function isActiveTab() {
  return document.visibilityState === "visible" && document.hasFocus();
}
