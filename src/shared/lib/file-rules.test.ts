import { describe, expect, it } from "vitest";
import { acceptOf, formatsOf, validateUpload } from "./file-rules";

const MB = 1024 * 1024;

describe("правила загрузки файлов (зеркало FileKinds в C#)", () => {
  it("видео до 1 ГБ, только mp4 и webm", () => {
    expect(validateUpload("video", { name: "Лекция.MP4", size: 500 * MB })).toEqual({});
    expect(validateUpload("video", { name: "a.mp4", size: 1025 * MB }).size).toBe("Файл больше 1 ГБ");
    expect(validateUpload("video", { name: "a.avi", size: 10 }).fileName).toBe(
      "Этот формат не подходит. Можно: mp4, webm",
    );
  });

  it("обложка до 5 МБ, пустой файл не принимается", () => {
    expect(validateUpload("cover", { name: "c.webp", size: 5 * MB })).toEqual({});
    expect(validateUpload("cover", { name: "c.png", size: 0 }).size).toBe("Файл пустой");
    expect(validateUpload("cover", { name: "c.png", size: 6 * MB }).size).toBe("Файл больше 5 МБ");
  });

  it("файл работы — документы, архив и картинки до 50 МБ", () => {
    for (const name of ["work.docx", "work.pdf", "work.zip", "photo.jpg"])
      expect(validateUpload("submission", { name, size: MB })).toEqual({});
    expect(validateUpload("submission", { name: "run.exe", size: MB }).fileName).toMatch(/^Этот формат/);
  });

  it("подсказка и accept для выбора файла", () => {
    expect(formatsOf("document")).toBe("pdf");
    expect(acceptOf("video")).toBe(".mp4,.webm");
  });
});
