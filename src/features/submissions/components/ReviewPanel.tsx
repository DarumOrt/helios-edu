"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { Star, FileText, Send } from "lucide-react";
import { Card, CardBody, CardHeader, Button, Textarea, Input, Avatar, Badge } from "@/shared/ui";
import { formatDateTime } from "@/shared/lib/format";
import { submissionsApi, type SubmissionFull } from "../api";

export function ReviewPanel({ submission }: { submission: SubmissionFull | null }) {
  const { mutate } = useSWRConfig();
  // форма сбрасывается через key у родителя, без синхронизирующего useEffect
  const [grade, setGrade] = useState<string>(submission?.grade != null ? String(submission.grade) : "");
  const [feedback, setFeedback] = useState<string>(submission?.feedback ?? "");
  const [saving, setSaving] = useState(false);

  if (!submission) {
    return (
      <Card className="h-full">
        <CardBody className="flex h-full flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText size={22} />
          </div>
          <p className="text-sm text-muted-foreground">Выберите работу слева, чтобы проверить</p>
        </CardBody>
      </Card>
    );
  }

  async function save() {
    const g = Number(grade);
    if (Number.isNaN(g) || g < 0 || g > (submission!.maxGrade ?? 100)) {
      toast.error("Введите корректную оценку", { description: `0–${submission!.maxGrade}` });
      return;
    }
    setSaving(true);
    try {
      await submissionsApi.review(submission!.id, g, feedback);
      toast.success("Оценка выставлена", { description: `${submission!.userName}: ${g} баллов` });
      mutate((key) => typeof key === "string" && key.startsWith("/api/submissions"));
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="h-full">
      <CardHeader
        title={submission.assignmentTitle}
        subtitle={submission.courseTitle}
        icon={<Star size={18} />}
        action={
          submission.status === "reviewed" ? (
            <Badge tone="success">проверено</Badge>
          ) : (
            <Badge tone="warning">на проверке</Badge>
          )
        }
      />
      <CardBody className="space-y-5">
        <div className="flex items-center gap-3">
          <Avatar name={submission.userName} size={40} />
          <div>
            <div className="font-medium">{submission.userName}</div>
            <div className="text-xs text-muted-foreground">
              {submission.group} · сдано {formatDateTime(submission.submittedAt)}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Ответ студента</div>
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap">
            {submission.text || "—"}
          </div>
          {submission.fileName && (
            <div className="mt-2 flex items-center gap-2 text-xs text-primary">
              <FileText size={13} /> {submission.fileName}
            </div>
          )}
        </div>

        <div className="grid grid-cols-[120px_1fr] items-start gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Оценка (0–{submission.maxGrade})
            </label>
            <Input
              type="number"
              min={0}
              max={submission.maxGrade}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="—"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Комментарий</label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Обратная связь студенту…"
              className="min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Send size={15} />
            {saving
              ? "Сохранение…"
              : submission.status === "reviewed"
                ? "Обновить оценку"
                : "Выставить оценку"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
