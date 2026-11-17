"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileText, Presentation, Activity, Eye, CheckCircle2 } from "lucide-react";
import { Card, CardBody, Progress, Button } from "@/shared/ui";
import { tracker, newSessionId } from "@/shared/lib/tracking/tracker";
import { useSession } from "@/shared/auth/session";
import { fmtDuration } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

const COMPLETE_AT = 80; // % уникальных страниц для зачёта
const PROGRESS_EVERY_MS = 4000;

// ЗАГЛУШКА рендеринга: в проде здесь PDF.js (canvas) / сконвертированные слайды.
// Сейчас показываем плейсхолдеры страниц, но трекинг просмотра — настоящий.
export function DocumentReader({
  courseId,
  activityId,
  kind,
  totalPages,
  pageTitles,
  onComplete,
  navigation,
  hasFile,
}: {
  /** курс материала — id материалов уникальны только внутри курса */
  courseId: string;
  activityId: string;
  /** вызывается один раз, когда материал засчитан */
  onComplete?: (coverage: number) => void;
  kind: "pdf" | "presentation";
  hasFile?: boolean;
  totalPages: number;
  pageTitles?: string[];
  navigation?: ReactNode;
}) {
  const user = useSession((s) => s.user);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const sessionRef = useRef(newSessionId());
  const viewed = useRef<Set<number>>(new Set([0]));
  const activeSec = useRef(0);
  const completedRef = useRef(false);
  const lastSent = useRef(0);

  const [page, setPage] = useState(0);
  // снимок для рендера: ref нужен таймеру, state — разметке
  const [viewedPages, setViewedPages] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [coverage, setCoverage] = useState(Math.round((1 / totalPages) * 100));
  const [activeTime, setActiveTime] = useState(0);
  const [completed, setCompleted] = useState(false);

  const Icon = kind === "pdf" ? FileText : Presentation;

  function sendProgress(useBeacon = false) {
    tracker.progress(
      {
        courseId,
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
      useBeacon,
    );
  }

  useEffect(() => {
    const sessionId = sessionRef.current;
    tracker.event({
      courseId,
      sessionId,
      userId: user.id,
      activityId,
      activityType: kind,
      verb: "opened",
    });
    return () => {
      sendProgress(true);
      tracker.event({
        courseId,
        sessionId,
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
          courseId,
          sessionId: sessionRef.current,
          userId: user.id,
          activityId,
          activityType: kind,
          verb: "completed",
        });
        toast.success("Материал засчитан", { description: `Просмотрено ${cov}% страниц` });
        onCompleteRef.current?.(cov);
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
      setViewedPages(new Set(viewed.current));
      tracker.event({
        courseId,
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <Card className="overflow-hidden">
          {/* область рендера страницы (заглушка) */}
          <div className="flex min-h-52 flex-col items-center justify-center border-b bg-muted/40 px-4 py-8 text-center sm:min-h-64">
            <Icon size={36} className="text-muted-foreground" aria-hidden />
            <div className="mt-4 text-lg font-semibold text-foreground/70">
              {pageTitles?.[page] ?? `Страница ${page + 1}`}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {page + 1} из {totalPages}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {hasFile
                ? "Откройте файл в новой вкладке. Здесь можно отмечать страницы по мере чтения."
                : "Файл пока недоступен."}
            </p>
          </div>
          <CardBody className="flex items-center justify-between py-3">
            <Button variant="outline" size="sm" onClick={() => go(page - 1)} disabled={page === 0}>
              <ChevronLeft size={15} /> Назад
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => go(page + 1)}
              disabled={page === totalPages - 1}
            >
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
              aria-label={`Страница ${i + 1}`}
              aria-current={i === page ? "page" : undefined}
              className={cn(
                "h-8 w-8 rounded-md border text-xs font-medium transition",
                i === page
                  ? "border-primary bg-primary text-primary-foreground"
                  : viewedPages.has(i)
                    ? "border-success/20 bg-success-soft text-success"
                    : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <Card className="border-border">
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Activity size={16} className="text-primary" aria-hidden />
              Прогресс по документу
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Отмечено страниц</span>
                <span className="font-semibold tabular-nums">
                  {viewedPages.size} / {totalPages}
                </span>
              </div>
              <Progress
                value={coverage}
                label="Доля отмеченных страниц"
                tone={completed ? "success" : "primary"}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Eye size={11} aria-hidden /> Время на странице урока
                </div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{fmtDuration(activeTime)}</div>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">Доля страниц</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{coverage}%</div>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t pt-2 text-xs">
              {completed ? (
                <span className="flex items-center gap-1.5 font-medium text-success">
                  <CheckCircle2 size={14} /> Материал изучен
                </span>
              ) : (
                <span className="text-muted-foreground">Для зачёта отметьте {COMPLETE_AT}% страниц.</span>
              )}
            </div>
          </CardBody>
        </Card>
        {navigation}
      </div>
    </div>
  );
}
