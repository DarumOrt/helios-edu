import type { FileKind } from "@/shared/types/domain";
import type { FieldErrors } from "./management-validation";

// Правила загрузки файлов — те же форматы, лимиты и тексты, что в C# (Files/StoredFile.cs, FileKinds).
// Интерфейс проверяет заранее, чтобы не начинать загрузку гигабайта, который сервер всё равно не примет.

const MB = 1024 * 1024;

export const FILES_SERVER_ONLY = "Загрузка файлов — в режиме «Сервер»";

interface Rule {
  maxBytes: number;
  limitText: string;
  /** расширение → тип, который отдаст хранилище */
  types: Record<string, string>;
}

export const FILE_RULES: Record<FileKind, Rule> = {
  video: { maxBytes: 1024 * MB, limitText: "1 ГБ", types: { ".mp4": "video/mp4", ".webm": "video/webm" } },
  document: { maxBytes: 50 * MB, limitText: "50 МБ", types: { ".pdf": "application/pdf" } },
  cover: {
    maxBytes: 5 * MB,
    limitText: "5 МБ",
    types: { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" },
  },
  submission: {
    maxBytes: 50 * MB,
    limitText: "50 МБ",
    types: {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".odt": "application/vnd.oasis.opendocument.text",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".txt": "text/plain",
      ".zip": "application/zip",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    },
  },
};

const extension = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
};

/** Форматы вида файла для подсказки и атрибута accept: «mp4, webm» / ".mp4,.webm" */
export const formatsOf = (kind: FileKind) =>
  Object.keys(FILE_RULES[kind].types)
    .map((ext) => ext.slice(1))
    .join(", ");
export const acceptOf = (kind: FileKind) => Object.keys(FILE_RULES[kind].types).join(",");

/** Проверка файла до загрузки; тексты — как у полей ответа C# */
export function validateUpload(kind: FileKind, file: { name: string; size: number }): FieldErrors {
  const rule = FILE_RULES[kind];
  const e: FieldErrors = {};
  if (!file.name || file.name.length > 200) e.fileName = "Имя файла — от 1 до 200 символов";
  else if (!(extension(file.name) in rule.types))
    e.fileName = `Этот формат не подходит. Можно: ${formatsOf(kind)}`;
  if (file.size <= 0) e.size = "Файл пустой";
  else if (file.size > rule.maxBytes) e.size = `Файл больше ${rule.limitText}`;
  return e;
}
