"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Card, CardBody, Badge, Progress } from "@/shared/ui";
import { Eye, Gauge, MousePointerClick, Pause, CheckCircle2, Activity } from "lucide-react";
import { tracker, newSessionId } from "@/shared/lib/tracking/tracker";
import { useSession } from "@/shared/auth/session";
import { fmtDuration } from "@/shared/lib/format";
import { fetcher } from "@/shared/lib/api-client";
import type { ActivityProgress } from "@/shared/lib/tracking/types";

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
  onComplete,
}: {
  activityId: string;
  src: string;
  title: string;
  /** вызывается один раз, когда материал засчитан */
  onComplete?: (coverage: number) => void;
}) {
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const user = useSession((s) => s.user);
  const videoRef = useRef<HTMLVideoElement>(null);
  // прежний прогресс: покрытие не начинается с нуля, просмотр продолжается с места остановки
  const { data: prior } = useSWR<ActivityProgress | null>(
    `/api/tracking/progress?userId=${encodeURIComponent(user.id)}&activityId=${encodeURIComponent(activityId)}`,
    fetcher,
    { revalidateOnFocus: false, revalidateIfStale: false },
  );
  const priorRef = useRef<ActivityProgress | null>(null);
  const resumed = useRef(false);
  // переход к месту остановки — не перемотка ученика
  const autoSeek = useRef(false);

  const sessionRef = useRef(newSessionId());
  const watched = useRef<Set<number>>(new Set());
  const activeSec = useRef(0);
  const seeks = useRef(0);
  const pauses = useRef(0);
  const maxRate = useRef(1);
  const completedRef = useRef(false);
  const lastProgressSent = useRef(0);

  useEffect(() => {
    priorRef.current = prior ?? null;
    if (prior?.completed) completedRef.current = true;
    resume();
  }, [prior]);

  /** Перейти к месту остановки — один раз, когда известны и прогресс, и длина видео. */
  function resume() {
    const v = videoRef.current;
    const at = priorRef.current?.position;
    if (resumed.current || !v || !v.duration || at == null) return;
    resumed.current = true;
    // досмотренное до конца начинаем сначала
    if (at > 1 && at < v.duration - 5) {
      autoSeek.current = true;
      v.currentTime = at;
    }
  }

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
    const sessionId = sessionRef.current;
    tracker.event({
      sessionId,
      userId: user.id,
      activityId,
      activityType: "video",
      verb: "opened",
    });
    return () => {
      sendProgress(true);
      tracker.event({
        sessionId,
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

  /** Покрытие: эта сессия, но не меньше прежнего (корзины прошлых сессий не хранятся). */
  function coverage() {
    const tb = totalBuckets();
    const session = tb > 0 ? Math.min(100, Math.round((watched.current.size / tb) * 100)) : 0;
    return Math.max(session, priorRef.current?.coverage ?? 0);
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
        position: v ? Math.round(v.currentTime) : undefined,
        ts: Date.now(),
      },
      useBeacon,
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
        onCompleteRef.current?.(cov);
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

  const ev = (
    verb: "played" | "paused" | "seeked" | "ratechanged",
    position?: number,
    payload?: Record<string, unknown>,
  ) =>
    tracker.event({
      sessionId: sessionRef.current,
      userId: user.id,
      activityId,
      activityType: "video",
      verb,
      position,
      payload,
    });

  // до первого тика — прежние покрытие и статус
  const shownCoverage = Math.max(stats.coverage, prior?.coverage ?? 0);
  const shownCompleted = stats.completed || Boolean(prior?.completed);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="overflow-hidden">
          <video
            ref={videoRef}
            src={src}
            controls
            className="aspect-video w-full bg-black"
            onPlay={(e) => ev("played", e.currentTarget.currentTime)}
            onPause={(e) => {
              if (e.currentTarget.ended) return;
              pauses.current += 1;
              ev("paused", e.currentTarget.currentTime);
            }}
            onLoadedMetadata={resume}
            onSeeked={(e) => {
              if (autoSeek.current) {
                autoSeek.current = false;
                return;
              }
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
              <Badge tone={shownCompleted ? "success" : stats.playing ? "info" : "neutral"}>
                {shownCompleted ? "завершено" : stats.playing ? "идёт просмотр" : "пауза"}
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
            <span className="ml-auto text-xs font-normal text-muted-foreground">live</span>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Покрытие материала</span>
              <span className="font-semibold tabular-nums">{shownCoverage}%</span>
            </div>
            <Progress value={shownCoverage} tone={shownCompleted ? "success" : "primary"} />
            <div className="mt-1 text-xs text-muted-foreground">
              засчитывается только просмотр с активной вкладкой, перемотка не считается
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric icon={Eye} label="Активное время" value={fmtDuration(stats.activeTimeSec)} />
            <Metric icon={Gauge} label="Макс. скорость" value={`${stats.maxRate}x`} />
            <Metric icon={MousePointerClick} label="Перемоток" value={String(stats.seeks)} />
            <Metric icon={Pause} label="Пауз" value={String(stats.pauses)} />
          </div>

          <div className="flex items-center gap-2 border-t pt-2 text-xs">
            {shownCompleted ? (
              <span className="flex items-center gap-1.5 font-medium text-success">
                <CheckCircle2 size={14} /> Материал изучен
              </span>
            ) : (
              <span className="text-muted-foreground">Досмотрите до {COMPLETE_AT}% покрытия для зачёта</span>
            )}
          </div>
        </CardBody>
      </Card>
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
