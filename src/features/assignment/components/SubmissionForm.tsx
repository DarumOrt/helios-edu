"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, CheckCircle2 } from "lucide-react";
import { Button, Card, CardBody, Textarea } from "@/shared/ui";
import { assignmentApi } from "../api";
import { useSession } from "@/shared/auth/session";
import { apiErrorInfo } from "@/shared/lib/api-client";

export function SubmissionForm({ courseId, assignmentId }: { courseId: string; assignmentId: string }) {
  const user = useSession((s) => s.user);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit() {
    setSubmitting(true);
    try {
      await assignmentApi.submit(courseId, assignmentId, { text, fileName, userId: user.id });
      setSubmitted(true);
      toast.success("Работа отправлена", { description: "Преподаватель получит уведомление" });
    } catch (failure) {
      toast.error("Не удалось отправить работу", { description: apiErrorInfo(failure).error });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="overflow-hidden">
        <CardBody className="py-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Работа отправлена</h3>
          <p className="mt-1 text-sm text-muted-foreground">Преподаватель проверит её в ближайшее время</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Текст ответа</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Опишите ваше решение…"
            className="min-h-[160px]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Файл (опционально)</label>
          <label className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed border-border px-4 py-6 transition hover:border-primary/50 hover:bg-primary-soft/40">
            <Upload size={18} className="text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                {fileName ?? "Перетащите файл или нажмите для выбора"}
              </div>
              <div className="text-xs text-muted-foreground">PDF, DOCX, ZIP — до 50 МБ</div>
            </div>
            <input type="file" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name)} />
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
