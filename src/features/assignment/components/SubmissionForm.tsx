"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, CheckCircle2 } from "lucide-react";
import { Button, Card, CardBody, Textarea } from "@/shared/ui";
import { assignmentApi } from "../api";

export function SubmissionForm({ assignmentId }: { assignmentId: string }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit() {
    setSubmitting(true);
    try {
      await assignmentApi.submit(assignmentId, { text, fileName });
      setSubmitted(true);
      toast.success("Работа отправлена", { description: "Преподаватель получит уведомление" });
    } catch {
      toast.error("Не удалось отправить работу");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-success to-emerald-400" />
        <CardBody className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-success-soft text-success mx-auto flex items-center justify-center">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Работа отправлена</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Преподаватель проверит её в ближайшее время
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-5">
        <div>
          <label className="text-sm font-medium block mb-1.5">Текст ответа</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Опишите ваше решение…"
            className="min-h-[160px]"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">Файл (опционально)</label>
          <label className="flex items-center gap-3 px-4 py-6 rounded-md border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary-soft/40 transition cursor-pointer">
            <Upload size={18} className="text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                {fileName ?? "Перетащите файл или нажмите для выбора"}
              </div>
              <div className="text-xs text-muted-foreground">PDF, DOCX, ZIP — до 50 МБ</div>
            </div>
            <input
              type="file"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name)}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSubmit} disabled={!text.trim() || submitting} size="lg">
            {submitting ? "Отправка…" : "Отправить на проверку"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
