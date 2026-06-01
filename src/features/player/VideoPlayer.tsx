"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardBody, Badge, Progress } from "@/shared/ui";
import { Eye, Gauge, MousePointerClick, Pause, CheckCircle2, Activity } from "lucide-react";
import { tracker, newSessionId } from "@/shared/lib/tracking/tracker";
import { useSessionStore } from "@/stores/session-store";
import { fmtDuration } from "@/shared/lib/format";

const BUCKET_SEC = 5; // размер корзины покрытия
const COMPLETE_AT = 90; // % покрытия для статуса "завершено"
const PROGRESS_EVERY_MS = 4000; // как часто слать снимок прогресса

interface LiveStats {
  coverage: number;
  activeTimeSec: number;
  seeks: number;
  pauses: number;
  maxRate: number;
  playing: boolean;
  completed: boolean;
  duration: number;
  position: number;
}

export function VideoPlayer({
  activityId,
  src,
  title,
}: {
  activityId: string;
  src: string;
  title: string;
}) {
  const user = useSessionStore((s) => s.user);
  const videoRef = useRef<HTMLVideoElement>(null);

  const sessionRef = useRef(newSessionId());
  const watched = useRef<Set<number>>(new Set());
  const activeSec = useRef(0);
  const seeks = useRef(0);
  const pauses = useRef(0);
  const maxRate = useRef(1);
  const completedRef = useRef(false);
  const lastProgressSent = useRef(0);

  const [stats, setStats] = useState<LiveStats>({
    coverage: 0,
    activeTimeSec: 0,
    seeks: 0,
    pauses: 0,
    maxRate: 1,
    playing: false,
    completed: false,
    duration: 0,
    position: 0,
  });

  // открытие
  useEffect(() => {
    tracker.event({
      sessionId: sessionRef.current,
      userId: user.id,
      activityId,
      activityType: "video",
      verb: "opened",
    });
    return () => {
      sendProgress(true);
      tracker.event({
        sessionId: sessionRef.current,
        userId: user.id,
        activityId,
        activityType: "video",
        verb: "closed",
      });
      tracker.flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function totalBuckets() {
    const d = videoRef.current?.duration ?? 0;
    return d > 0 ? Math.ceil(d / BUCKET_SEC) : 0;
  }

  function coverage() {
    const tb = totalBuckets();
    return tb > 0 ? Math.min(100, Math.round((watched.current.size / tb) * 100)) : 0;
  }

  function sendProgress(useBeacon = false) {
    const v = videoRef.current;
    tracker.progress(
      {
        sessionId: sessionRef.current,
        userId: user.id,
        activityId,
        activityType: "video",
        coverage: coverage(),
        activeTimeSec: Math.round(activeSec.current),
        completed: completedRef.current,
        seeks: seeks.current,
        pauses: pauses.current,
        maxRate: maxRate.current,
        durationSec: v?.duration ?? 0,
        ts: Date.now(),
      },
      useBeacon
    );
  }

  // тик раз в секунду: накапливаем активное время и помечаем корзину,
  // только если играет + вкладка в фокусе + скорость <= 2x
  useEffect(() => {
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      const focused = document.visibilityState === "visible";
      const eligible = !v.paused && !v.ended && focused && v.playbackRate <= 2;

      if (eligible) {
        activeSec.current += 1;
        watched.current.add(Math.floor(v.currentTime / BUCKET_SEC));
      }

      const cov = coverage();
      if (!completedRef.current && cov >= COMPLETE_AT) {
        completedRef.current = true;
        tracker.event({
          sessionId: sessionRef.current,
          userId: user.id,
          activityId,
          activityType: "video",
          verb: "completed",
          position: v.currentTime,
        });
        toast.success("Материал засчитан", { description: `Покрытие ${cov}%` });
      }

      setStats({
        coverage: cov,
        activeTimeSec: Math.round(activeSec.current),
        seeks: seeks.current,
        pauses: pauses.current,
        maxRate: maxRate.current,
        playing: !v.paused && !v.ended,
        completed: completedRef.current,
        duration: v.duration || 0,
        position: v.currentTime || 0,
      });

      if (Date.now() - lastProgressSent.current > PROGRESS_EVERY_MS) {
        lastProgressSent.current = Date.now();
        sendProgress();
        tracker.event({
          sessionId: sessionRef.current,
          userId: user.id,
          activityId,
          activityType: "video",
          verb: "heartbeat",
          position: v.currentTime,
          payload: { coverage: cov, playing: !v.paused },
        });
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ev = (verb: "played" | "paused" | "seeked" | "ratechanged", position?: number, payload?: Record<string, unknown>) =>
    tracker.event({
      sessionId: sessionRef.current,
      userId: user.id,
      activityId,
      activityType: "video",
      verb,
      position,
      payload,
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <Card className="overflow-hidden">
          <video
            ref={videoRef}
            src={src}
            controls
            className="w-full bg-black aspect-video"
            onPlay={(e) => ev("played", e.currentTarget.currentTime)}
            onPause={(e) => {
              if (e.currentTarget.ended) return;
              pauses.current += 1;
              ev("paused", e.currentTarget.currentTime);
            }}
            onSeeked={(e) => {
              seeks.current += 1;
              ev("seeked", e.currentTarget.currentTime);
            }}
            onRateChange={(e) => {
              maxRate.current = Math.max(maxRate.current, e.currentTarget.playbackRate);
              ev("ratechanged", e.currentTarget.currentTime, { rate: e.currentTarget.playbackRate });
            }}
            onEnded={() => sendProgress()}
          />
          <CardBody className="py-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{title}</h3>
              <Badge tone={stats.completed ? "success" : stats.playing ? "info" : "neutral"}>
                {stats.completed ? "завершено" : stats.playing ? "идёт просмотр" : "пауза"}
              </Badge>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* живая панель метрик — наглядно показывает, что трекается */}
      <Card className="h-fit">
        <CardBody className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity size={16} className="text-primary" />
            Ваша активность
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">live</span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Покрытие материала</span>
              <span className="font-semibold tabular-nums">{stats.coverage}%</span>
            </div>
            <Progress value={stats.coverage} tone={stats.completed ? "success" : "primary"} />
            <div className="text-[10px] text-muted-foreground mt-1">
              засчитывается только просмотр с активной вкладкой, перемотка не считается
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric icon={Eye} label="Активное время" value={fmtDuration(stats.activeTimeSec)} />
            <Metric icon={Gauge} label="Макс. скорость" value={`${stats.maxRate}x`} />
            <Metric icon={MousePointerClick} label="Перемоток" value={String(stats.seeks)} />
            <Metric icon={Pause} label="Пауз" value={String(stats.pauses)} />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t text-xs">
            {stats.completed ? (
              <span className="flex items-center gap-1.5 text-success font-medium">
                <CheckCircle2 size={14} /> Материал изучен
              </span>
            ) : (
              <span className="text-muted-foreground">
                Досмотрите до {COMPLETE_AT}% покрытия для зачёта
              </span>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Icon size={11} />
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
