import { Download, ExternalLink } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { buttonVariants } from "@/shared/ui";
import { activityHref } from "@/shared/lib/activity-href";
import { useMaterialView } from "@/shared/lib/material-view";
import type { Activity } from "@/shared/types/domain";

export function MaterialActions({
  courseId,
  activity,
  src,
  beforeOpen,
}: {
  courseId: string;
  activity: Pick<Activity, "id" | "type">;
  src: string;
  beforeOpen: () => Promise<void> | undefined;
}) {
  const [externalHelp, setExternalHelp] = useState(false);
  const standalone = useMaterialView();
  const style = buttonVariants({ variant: "outline", size: "sm" });
  const downloadUrl = src.startsWith("/api/files/") ? src + "?download=1" : src;

  async function downloadExternal(event: MouseEvent<HTMLAnchorElement>) {
    const url = new URL(src, window.location.href);
    if (url.origin === location.origin) return;
    event.preventDefault();
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const blob = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blob;
      link.download = decodeURIComponent(url.pathname.split("/").at(-1) || "Материал");
      link.click();
      setTimeout(() => URL.revokeObjectURL(blob), 60000);
    } catch {
      setExternalHelp(true);
    }
  }

  async function openLesson(event: MouseEvent<HTMLAnchorElement>) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const pending = beforeOpen();
    if (!pending) return;
    // Открываем окно в рамках клика. К моменту GET прогресс уже принят сервером.
    const tab = window.open("about:blank", "_blank");
    if (!tab) return;
    event.preventDefault();
    tab.opener = null;
    const href = event.currentTarget.href;
    try {
      await pending;
    } finally {
      if (!tab.closed) tab.location.replace(href);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a download href={downloadUrl} onClick={downloadExternal} className={style}>
        <Download size={15} aria-hidden /> Скачать оригинал
      </a>
      {!standalone && (
        <a
          href={activityHref(courseId, activity) + "?view=material"}
          onClick={openLesson}
          target="_blank"
          rel="noopener noreferrer"
          className={style}
        >
          <ExternalLink size={15} aria-hidden /> Открыть просмотр в новой вкладке
        </a>
      )}
      {externalHelp && (
        <p className="w-full text-sm" role="status">
          Для сохранения файла с внешнего сайта используйте команду браузера «Сохранить ссылку как…» для
          кнопки скачивания.
        </p>
      )}
    </div>
  );
}
