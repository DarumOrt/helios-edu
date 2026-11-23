"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { Button, Card, CardBody, Progress } from "@/shared/ui";
import { fmtDuration } from "@/shared/lib/format";
import { MaterialActions } from "./MaterialActions";
import { isActiveTab, useMediaTracking } from "./useMediaTracking";

const assets = `/pdfjs/${pdfjs.version}/`;
pdfjs.GlobalWorkerOptions.workerSrc = assets + "build/pdf.worker.min.mjs";
const options = {
  cMapUrl: assets + "cmaps/",
  cMapPacked: true,
  standardFontDataUrl: assets + "standard_fonts/",
  wasmUrl: assets + "wasm/",
  iccUrl: assets + "iccs/",
};

export default function PdfReader({
  courseId,
  activityId,
  src,
  navigation,
  onViewed,
  onComplete,
}: {
  courseId: string;
  activityId: string;
  src?: string;
  navigation: ReactNode;
  onViewed: () => void;
  onComplete: (coverage: number) => void;
}) {
  const tracking = useMediaTracking(courseId, activityId, "pdf", onViewed, onComplete);
  const [totalPages, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rendered, setRendered] = useState<number | null>(null);
  const [renderError, setRenderError] = useState(false);
  const [width, setWidth] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const lastViewed = useRef<number | null>(null);
  const lastTick = useRef<number | null>(null);
  const visible = useRef(false);
  const tick = useEffectEvent(() => {
    if (!visible.current || !isActiveTab() || page !== rendered) {
      lastTick.current = null;
      return;
    }
    const now = Date.now();
    const start = lastTick.current;
    lastTick.current = now;
    tracking.record(
      { totalPages, position: page },
      [page, page + 1],
      start !== null && now - start <= 2000 ? [start, now] : undefined,
    );
    if (lastViewed.current !== page) {
      tracking.event("page_viewed", page);
      lastViewed.current = page;
    }
  });

  useEffect(() => {
    if (!frame.current) return;
    const resize = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      tick();
    });
    resize.observe(frame.current);
    observer.observe(frame.current);
    const focus = () => tick();
    const reset = () => {
      lastTick.current = null;
    };
    window.addEventListener("focus", focus);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    const timer = setInterval(focus, 1000);
    return () => {
      resize.disconnect();
      observer.disconnect();
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, []);
  useEffect(() => {
    tick();
  }, [rendered, page]);

  function go(next: number) {
    setRendered(null);
    setRenderError(false);
    lastTick.current = null;
    setPage(next);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <Card className="overflow-hidden">
          <div ref={frame} className="min-w-0">
            {!src ? (
              <p className="p-4">PDF-файл пока не добавлен.</p>
            ) : tracking.error && tracking.prior === undefined ? (
              <p className="p-4">Не удалось загрузить прогресс просмотра.</p>
            ) : tracking.prior === undefined ? (
              <p className="p-4">Загрузка прогресса…</p>
            ) : (
              <Document
                file={src}
                options={options}
                suspense={false}
                loading={<p className="p-4">Загрузка PDF…</p>}
                error={
                  <p className="p-4" role="alert">
                    Не удалось открыть PDF. Проверьте доступ к оригиналу.
                  </p>
                }
                onLoadSuccess={({ numPages }) => {
                  setPage(Math.min(numPages - 1, Math.max(0, tracking.prior?.position ?? 0)));
                  setTotal(numPages);
                }}
              >
                {totalPages > 0 && width > 0 && (
                  <Page
                    key={page}
                    pageNumber={page + 1}
                    width={width}
                    suspense={false}
                    renderAnnotationLayer={false}
                    loading="Загрузка страницы…"
                    error="Не удалось загрузить страницу."
                    onRenderSuccess={({ pageNumber }) => setRendered(pageNumber - 1)}
                    onRenderError={() => {
                      setRendered(null);
                      setRenderError(true);
                    }}
                  />
                )}
              </Document>
            )}
            {renderError && (
              <p className="p-3" role="alert">
                Не удалось отобразить страницу.
              </p>
            )}
          </div>
          {totalPages > 0 && (
            <CardBody className="flex flex-wrap items-center justify-between gap-2 py-3">
              <Button size="sm" variant="outline" onClick={() => go(page - 1)} disabled={page === 0}>
                Назад
              </Button>
              <label className="flex flex-wrap items-center gap-1 text-sm tabular-nums">
                Страница
                <input
                  key={page}
                  type="number"
                  min={1}
                  max={totalPages}
                  defaultValue={page + 1}
                  className="w-16 rounded border bg-background px-1 py-1 text-center"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  onBlur={(e) => {
                    const target = e.currentTarget.valueAsNumber;
                    if (
                      Number.isInteger(target) &&
                      target >= 1 &&
                      target <= totalPages &&
                      target !== page + 1
                    )
                      go(target - 1);
                    else e.currentTarget.value = String(page + 1);
                  }}
                />{" "}
                из {totalPages}
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => go(page + 1)}
                disabled={page >= totalPages - 1}
              >
                Вперёд
              </Button>
            </CardBody>
          )}
        </Card>
        {src && (
          <MaterialActions
            courseId={courseId}
            activity={{ id: activityId, type: "pdf" }}
            src={src}
            beforeOpen={tracking.saveNow}
          />
        )}
      </div>
      <div className="min-w-0 space-y-4">
        {totalPages > 0 && (
          <Card>
            <CardBody className="space-y-2">
              <h2 className="font-semibold">Прогресс чтения</h2>
              <p>
                Просмотрено страниц: {tracking.stats.pagesViewed} из {totalPages}
              </p>
              <Progress value={tracking.stats.coverage} label="Просмотренные страницы" />
              <p className="text-sm">Активное время: {fmtDuration(tracking.stats.activeTimeSec)}</p>
              <p className="text-sm">
                {tracking.stats.completed ? "Материал изучен" : "Для зачёта откройте 80% страниц."}
              </p>
            </CardBody>
          </Card>
        )}
        {navigation}
      </div>
    </div>
  );
}
