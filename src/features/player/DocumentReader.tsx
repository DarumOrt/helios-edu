"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileText, Presentation, Activity, Eye, CheckCircle2 } from "lucide-react";
import { Card, CardBody, Badge, Progress, Button } from "@/shared/ui";
import { tracker, newSessionId } from "@/shared/lib/tracking/tracker";
import { useSessionStore } from "@/stores/session-store";
import { fmtDuration } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

const COMPLETE_AT = 80; // % уникальных страниц для зачёта
const PROGRESS_EVERY_MS = 4000;

// ЗАГЛУШКА рендеринга: в проде здесь PDF.js (canvas) / сконвертированные слайды.
// Сейчас показываем плейсхолдеры страниц, но трекинг просмотра — настоящий.
export function DocumentReader({
  activityId,
  kind,
  title,
  totalPages,
  pageTitles,
}: {
  activityId: string;
  kind: "pdf" | "presentation";
  title: string;
  totalPages: number;
  pageTitles?: string[];
}) {
  const user = useSessionStore((s) => s.user);
  const sessionRef = useRef(newSessionId());
  const viewed = useRef<Set<number>>(new Set([0]));
  const activeSec = useRef(0);
  const completedRef = useRef(false);
  const lastSent = useRef(0);

  const [page, setPage] = useState(0);
  const [coverage, setCoverage] = useState(Math.round((1 / totalPages) * 100));
  const [activeTime, setActiveTime] = useState(0);
  const [completed, setCompleted] = useState(false);

  const Icon = kind === "pdf" ? FileText : Presentation;

  function sendProgress(useBeacon = false) {
    tracker.progress(
      {
        sessionId: sessionRef.current,
        userId: user.id,
        activityId,
        activityType: kind,
        coverage: Math.min(100, Math.round((viewed.current.size / totalPages) * 100)),
        activeTimeSec: Math.round(activeSec.current),
        completed: completedRef.current,
        pagesViewed: viewed.current.size,
        totalPages,
        ts: Date.now(),
      },
      useBeacon
    );
  }

  useEffect(() => {
    tracker.event({
      sessionId: sessionRef.current,
      userId: user.id,
      activityId,
      activityType: kind,
      verb: "opened",
    });
    return () => {
      sendProgress(true);
      tracker.event({
        sessionId: sessionRef.current,
        userId: user.id,
        activityId,
        activityType: kind,
        verb: "closed",
      });
      tracker.flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // тик: активное время на странице только при фокусе
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") activeSec.current += 1;
      const cov = Math.min(100, Math.round((viewed.current.size / totalPages) * 100));
      if (!completedRef.current && cov >= COMPLETE_AT) {
        completedRef.current = true;
        setCompleted(true);
        tracker.event({
          sessionId: sessionRef.current,
          userId: user.id,
          activityId,
          activityType: kind,
          verb: "completed",
        });
        toast.success("Материал засчитан", { description: `Просмотрено ${cov}% страниц` });
      }
      setCoverage(cov);
      setActiveTime(Math.round(activeSec.current));
      if (Date.now() - lastSent.current > PROGRESS_EVERY_MS) {
        lastSent.current = Date.now();
        sendProgress();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(next: number) {
    const p = Math.max(0, Math.min(totalPages - 1, next));
    setPage(p);
    if (!viewed.current.has(p)) {
      viewed.current.add(p);
      tracker.event({
        sessionId: sessionRef.current,
        userId: user.id,
        activityId,
        activityType: kind,
        verb: "page_viewed",
        position: p,
      });
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <Card className="overflow-hidden">
          {/* область рендера страницы (заглушка) */}
          <div className="relative bg-muted/40 aspect-[4/3] flex flex-col items-center justify-center border-b">
            <Icon size={40} className="text-muted-foreground/40" />
            <div className="mt-4 text-lg font-semibold text-foreground/70">
              {pageTitles?.[page] ?? `Страница ${page + 1}`}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {kind === "pdf" ? "PDF-документ" : "Презентация"} · {page + 1} из {totalPages}
            </div>
            <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground/60">
              демо-рендер · в проде здесь PDF.js
            </div>
          </div>
          <CardBody className="flex items-center justify-between py-3">
            <Button variant="outline" size="sm" onClick={() => go(page - 1)} disabled={page === 0}>
              <ChevronLeft size={15} /> Назад
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => go(page + 1)} disabled={page === totalPages - 1}>
              Вперёд <ChevronRight size={15} />
            </Button>
          </CardBody>
        </Card>

        {/* миниатюры с отметкой просмотренных */}
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={cn(
                "w-8 h-8 rounded-md text-xs font-medium border transition",
                i === page
                  ? "bg-primary text-primary-foreground border-primary"
                  : viewed.current.has(i)
                  ? "bg-success-soft text-success border-success/20"
                  : "bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <Card className="h-fit">
        <CardBody className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity size={16} className="text-primary" />
            Ваша активность
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">live</span>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Просмотрено страниц</span>
              <span className="font-semibold tabular-nums">
                {viewed.current.size} / {totalPages}
              </span>
            </div>
            <Progress value={coverage} tone={completed ? "success" : "primary"} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Eye size={11} /> Время чтения
              </div>
              <div className="text-sm font-semibold tabular-nums mt-0.5">{fmtDuration(activeTime)}</div>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                покрытие
              </div>
              <div className="text-sm font-semibold tabular-nums mt-0.5">{coverage}%</div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t text-xs">
            {completed ? (
              <span className="flex items-center gap-1.5 text-success font-medium">
                <CheckCircle2 size={14} /> Материал изучен
              </span>
            ) : (
              <span className="text-muted-foreground">Просмотрите {COMPLETE_AT}% страниц для зачёта</span>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
