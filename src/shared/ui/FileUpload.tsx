"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useSession } from "@/shared/auth/session";
import { apiErrorInfo } from "@/shared/lib/api-client";
import { acceptOf, FILE_RULES, FILES_SERVER_ONLY, formatsOf } from "@/shared/lib/file-rules";
import { uploadFile } from "@/shared/lib/upload";
import type { FileKind, UploadedFile } from "@/shared/types/domain";
import { Button } from "./Button";
import { Progress } from "./Progress";

/**
 * Кнопка «Загрузить файл» с прогрессом: файл уходит в хранилище курса, наружу — загруженный файл (url).
 * В демо хранилища нет — кнопка неактивна с подсказкой (упор на серверный режим, AGENTS.md).
 */
export function FileUpload({
  id,
  kind,
  courseId,
  onUploaded,
  label = "Загрузить файл",
  disabled,
}: {
  id?: string;
  kind: FileKind;
  courseId: string;
  onUploaded: (file: UploadedFile, durationMin?: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  const server = useSession((s) => s.dataSource.source === "server");
  const preview = useSession((s) => Boolean(s.user.previewContext));
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const hint = preview
    ? "Файлы можно загрузить в основном кабинете"
    : server
      ? `${formatsOf(kind)} — до ${FILE_RULES[kind].limitText}`
      : FILES_SERVER_ONLY;

  async function pick(file: File | undefined) {
    if (!file) return;
    setProgress(0);
    try {
      const uploaded = await uploadFile(kind, courseId, file, setProgress);
      const duration = kind === "video" ? await videoMinutes(file) : undefined;
      if (mounted.current) onUploaded(uploaded, duration);
    } catch (failure) {
      toast.error("Файл не загружен", { description: apiErrorInfo(failure).error ?? "Попробуйте ещё раз" });
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => input.current?.click()}
          disabled={!server || preview || disabled || progress !== null}
        >
          <Upload size={15} aria-hidden /> {progress === null ? label : `Загрузка… ${progress}%`}
        </Button>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      {progress !== null && <Progress value={progress} />}
      <input
        ref={input}
        type="file"
        disabled={!server || preview || disabled || progress !== null}
        accept={acceptOf(kind)}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}

// Для списка материалов храним минуты. Плеер показывает точное время из самого файла.
function videoMinutes(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const finish = () => {
      const minutes = Math.ceil(video.duration / 60);
      clearTimeout(timer);
      video.onloadedmetadata = video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(minutes > 0 && minutes <= 600 ? minutes : undefined);
    };
    const timer = setTimeout(finish, 5000);
    video.preload = "metadata";
    video.onloadedmetadata = video.onerror = finish;
    video.src = url;
  });
}
