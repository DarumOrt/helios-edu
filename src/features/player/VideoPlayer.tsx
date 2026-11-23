"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Card, CardBody, Badge, Progress } from "@/shared/ui";
import { Eye, Gauge, MousePointerClick, Pause, CheckCircle2, Activity } from "lucide-react";
import { fmtDuration } from "@/shared/lib/format";
import { MaterialActions } from "./MaterialActions";
import { isActiveTab, useMediaTracking } from "./useMediaTracking";

export function VideoPlayer({
  courseId,
  activityId,
  src,
  title,
  onViewed,
  onComplete,
  navigation,
}: {
  courseId: string;
  activityId: string;
  src: string;
  title: string;
  onViewed?: () => void;
  onComplete?: (coverage: number) => void;
  navigation?: ReactNode;
}) {
  const tracking = useMediaTracking(courseId, activityId, "video", onViewed, onComplete);
  const stats = tracking.stats;
  const shownCoverage = stats.coverage;
  const shownCompleted = stats.completed;
  const restoring = useRef(false);
  const previous = useRef<{ time: number; wall: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [duration, setDuration] = useState(0);
  const [seeks, setSeeks] = useState(0);
  const [pauses, setPauses] = useState(0);
  const [maxRate, setMaxRate] = useState(1);

  useEffect(() => {
    const reset = () => {
      previous.current = null;
    };
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, []);

  function anchor(v: HTMLVideoElement) {
    previous.current =
      isActiveTab() && v.playbackRate > 0 && v.playbackRate <= 2
        ? { time: Math.round(v.currentTime * 1000), wall: Date.now() }
        : null;
  }

  function sample(v: HTMLVideoElement) {
    const last = previous.current;
    if (v.seeking || !Number.isFinite(v.duration) || !isActiveTab() || v.playbackRate > 2) {
      previous.current = null;
      return;
    }
    if (v.paused && !last) return;
    anchor(v);
    const next = previous.current;
    if (!last || !next || next.time <= last.time || next.wall - last.wall > 2000) return;
    // played содержит только реально воспроизведённые участки, даже при перемотке между событиями.
    for (let i = 0; i < v.played.length; i++) {
      const from = Math.max(last.time, Math.round(v.played.start(i) * 1000));
      const to = Math.min(next.time, Math.round(v.played.end(i) * 1000));
      if (to > from)
        tracking.record(
          { durationSec: v.duration, position: Math.floor(v.currentTime), seeks, pauses, maxRate },
          [from, to],
          [last.wall, next.wall],
        );
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <Card className="overflow-hidden">
          {tracking.readyToView ? (
            <video
              src={src}
              aria-label={title}
              controls
              className="aspect-video w-full bg-black"
              preload="metadata"
              onError={() => setFailed(true)}
              onLoadedMetadata={({ currentTarget: v }) => {
                const resume = tracking.prior?.position ?? 0;
                if (resume > 0 && resume < v.duration - 1) {
                  restoring.current = true;
                  v.currentTime = resume;
                }
                setDuration(Number.isFinite(v.duration) ? v.duration : 0);
              }}
              onPlaying={({ currentTarget: v }) => {
                anchor(v);
                setPlaying(true);
              }}
              onPlay={({ currentTarget: v }) => tracking.event("played", v.currentTime)}
              onTimeUpdate={({ currentTarget: v }) => sample(v)}
              onWaiting={() => {
                previous.current = null;
              }}
              onPause={({ currentTarget: v }) => {
                sample(v);
                previous.current = null;
                setPlaying(false);
                if (!v.ended && Number.isFinite(v.duration) && isActiveTab()) {
                  setPauses((n) => n + 1);
                  tracking.event("paused", v.currentTime);
                  tracking.record({
                    durationSec: v.duration,
                    position: Math.floor(v.currentTime),
                    pauses: pauses + 1,
                  });
                }
              }}
              onSeeking={() => {
                previous.current = null;
              }}
              onSeeked={({ currentTarget: v }) => {
                if (restoring.current) restoring.current = false;
                else if (isActiveTab()) {
                  setSeeks((n) => n + 1);
                  tracking.event("seeked", v.currentTime);
                  tracking.record({
                    durationSec: v.duration,
                    position: Math.floor(v.currentTime),
                    seeks: seeks + 1,
                  });
                }
                if (!v.paused) anchor(v);
              }}
              onRateChange={({ currentTarget: v }) => {
                previous.current = null;
                setMaxRate((n) => Math.max(n, v.playbackRate));
                tracking.event("ratechanged", v.currentTime, { rate: v.playbackRate });
              }}
            />
          ) : (
            <p className="p-4">Загрузка видео…</p>
          )}
          {failed && (
            <p role="alert" className="p-3 text-sm">
              Не удалось воспроизвести видео. Проверьте доступ к оригиналу.
            </p>
          )}
          <CardBody className="py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {duration ? `Длительность ${fmtDuration(duration)}` : "Видео"}
              </span>
              <Badge tone={shownCompleted ? "success" : playing ? "info" : "neutral"}>
                {shownCompleted ? "Завершено" : playing ? "Идёт просмотр" : "На паузе"}
              </Badge>
            </div>
          </CardBody>
        </Card>
        {tracking.error && (
          <p role="status" className="text-sm text-muted-foreground">
            Не удалось загрузить прогресс просмотра.
          </p>
        )}
        <MaterialActions
          courseId={courseId}
          activity={{ id: activityId, type: "video" }}
          src={src}
          beforeOpen={tracking.saveNow}
        />
      </div>

      <div className="min-w-0 space-y-4">
        <Card className="border-border">
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Activity size={16} className="text-primary" aria-hidden />
              Прогресс просмотра
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Просмотрено</span>
                <span className="font-semibold tabular-nums">{shownCoverage}%</span>
              </div>
              <Progress
                value={shownCoverage}
                label="Просмотрено видео"
                tone={shownCompleted ? "success" : "primary"}
              />
              <div className="mt-1 text-xs text-muted-foreground">
                Учитываются участки, просмотренные в активной вкладке.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Metric icon={Eye} label="Активное время" value={fmtDuration(stats.activeTimeSec)} />
              <Metric icon={Gauge} label="Макс. скорость" value={`${maxRate}x`} />
              <Metric icon={MousePointerClick} label="Перемоток" value={String(seeks)} />
              <Metric icon={Pause} label="Пауз" value={String(pauses)} />
            </div>

            <div className="flex items-center gap-2 border-t pt-2 text-xs">
              {shownCompleted ? (
                <span className="flex items-center gap-1.5 font-medium text-success">
                  <CheckCircle2 size={14} /> Материал изучен
                </span>
              ) : (
                <span className="text-muted-foreground">Для зачёта нужно посмотреть 90% видео.</span>
              )}
            </div>
          </CardBody>
        </Card>
        {navigation}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon size={11} />
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
