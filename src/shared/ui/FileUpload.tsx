"use client";

import { useRef, useState } from "react";
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
  kind,
  courseId,
  onUploaded,
  label = "Загрузить файл",
  disabled,
}: {
  kind: FileKind;
  courseId: string;
  onUploaded: (file: UploadedFile) => void;
  label?: string;
  disabled?: boolean;
}) {
  const server = useSession((s) => s.dataSource.source === "server");
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const hint = server ? `${formatsOf(kind)} — до ${FILE_RULES[kind].limitText}` : FILES_SERVER_ONLY;

  async function pick(file: File | undefined) {
    if (!file) return;
    setProgress(0);
    try {
      onUploaded(await uploadFile(kind, courseId, file, setProgress));
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
          type="button"
          variant="outline"
          size="sm"
          onClick={() => input.current?.click()}
          disabled={!server || disabled || progress !== null}
        >
          <Upload size={15} aria-hidden /> {progress === null ? label : `Загрузка… ${progress}%`}
        </Button>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      {progress !== null && <Progress value={progress} />}
      <input
        ref={input}
        type="file"
        accept={acceptOf(kind)}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
