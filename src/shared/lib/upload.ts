"use client";

import { api, ApiError } from "./api-client";
import { validateUpload } from "./file-rules";
import type { FileKind, UploadTicket, UploadedFile } from "@/shared/types/domain";

/**
 * Загрузка файла в хранилище (docs/backend/p6-files.md): C# проверяет права и выдаёт временную ссылку,
 * браузер отправляет файл напрямую в хранилище (с прогрессом), затем C# подтверждает загрузку.
 * Ошибки — ApiError с { error, fields } как у остальных форм.
 */
export async function uploadFile(
  kind: FileKind,
  courseId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
  const fields = validateUpload(kind, file);
  if (Object.keys(fields).length)
    throw new ApiError(400, "Проверьте файл", JSON.stringify({ error: Object.values(fields)[0], fields }));
  const ticket = await api.post<UploadTicket>("/api/files", {
    kind,
    courseId,
    fileName: file.name,
    size: file.size,
  });
  await put(ticket, file, onProgress);
  return api.post<UploadedFile>(`/api/files/${ticket.id}/complete`, {});
}

// XHR, а не fetch: только он сообщает о прогрессе отправки
function put(ticket: UploadTicket, file: File, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", ticket.uploadUrl);
    xhr.setRequestHeader("Content-Type", ticket.contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, "upload", JSON.stringify({ error: "Хранилище не приняло файл" })));
    xhr.onerror = () =>
      reject(new ApiError(0, "upload", JSON.stringify({ error: "Нет связи с хранилищем файлов" })));
    xhr.send(file);
  });
}
