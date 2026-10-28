"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, Clock, Paperclip, Pencil, X } from "lucide-react";
import { Badge, Button, Card, CardBody, FileUpload, Skeleton, Textarea } from "@/shared/ui";
import { assignmentApi } from "../api";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { apiErrorInfo, fetcher } from "@/shared/lib/api-client";
import { formatDateTime } from "@/shared/lib/format";
import type { MySubmission, SubmissionFull } from "@/shared/types/domain";

// Сдача задания: ученик видит свою работу и её статус. Пересдать до проверки можно только явно —
// кнопкой «Изменить ответ»; проверенную работу пересдать нельзя (C# и моки отвечают 409).
export function SubmissionForm({ courseId, assignmentId }: { courseId: string; assignmentId: string }) {
  const user = useSession((s) => s.user);
  const learner = can(user.role, "assignment.submit");
  const key = learner ? `/api/assignment/${assignmentId}/submission?courseId=${courseId}` : null;
  const { data, isLoading, mutate } = useSWR<MySubmission>(key, fetcher);
  const [editing, setEditing] = useState(false);

  if (!learner)
    return (
      <p className="text-sm text-muted-foreground">
        Работы студентов по заданию — в разделе «Проверка работ».
      </p>
    );
  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;

  const work = data.submission;
  if (work && !editing) return <SubmittedWork work={work} onEdit={() => setEditing(true)} />;
  return (
    <AnswerForm
      key={work?.id ?? "new"}
      initial={work}
      courseId={courseId}
      onCancel={work ? () => setEditing(false) : undefined}
      onSubmit={async (text, fileId) => {
        await assignmentApi.submit(courseId, assignmentId, { text, fileId, userId: user.id });
        await mutate();
        setEditing(false);
      }}
    />
  );
}

function SubmittedWork({ work, onEdit }: { work: SubmissionFull; onEdit: () => void }) {
  const reviewed = work.status === "reviewed";
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={
              reviewed
                ? "flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-success"
                : "flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary"
            }
          >
            {reviewed ? <CheckCircle2 size={20} aria-hidden /> : <Clock size={20} aria-hidden />}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{reviewed ? "Работа проверена" : "Работа отправлена"}</h3>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(work.submittedAt)}
              {reviewed ? "" : " · ждёт проверки преподавателем"}
            </p>
          </div>
          {reviewed ? (
            <Badge tone="success" className="font-mono text-sm">
              {work.grade} из {work.maxGrade}
            </Badge>
          ) : (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil size={15} aria-hidden /> Изменить ответ
            </Button>
          )}
        </div>
        {reviewed && work.feedback && (
          <div className="rounded-md border-l-2 border-success bg-success-soft/40 px-4 py-3 text-sm">
            <div className="mb-1 font-medium">Комментарий преподавателя</div>
            <p className="whitespace-pre-line">{work.feedback}</p>
          </div>
        )}
        <div>
          <div className="mb-1.5 text-sm font-medium">Ваш ответ</div>
          <p className="text-sm whitespace-pre-line text-foreground/90">{work.text || "—"}</p>
          {work.fileName &&
            (work.fileId ? (
              <a
                href={`/api/files/${work.fileId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex w-fit items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
              >
                <Paperclip size={14} aria-hidden /> {work.fileName}
              </a>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Paperclip size={14} aria-hidden /> {work.fileName}
              </p>
            ))}
        </div>
      </CardBody>
    </Card>
  );
}

function AnswerForm({
  initial,
  courseId,
  onCancel,
  onSubmit,
}: {
  initial?: SubmissionFull;
  courseId: string;
  onCancel?: () => void;
  onSubmit: (text: string, fileId?: string) => Promise<void>;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  // файл работы: прежний (при замене ответа) или только что загруженный в хранилище
  const [file, setFile] = useState(
    initial?.fileId && initial.fileName ? { id: initial.fileId, name: initial.fileName } : undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const replacing = Boolean(initial);

  async function submit() {
    setSubmitting(true);
    try {
      await onSubmit(text, file?.id);
      toast.success(replacing ? "Ответ заменён" : "Работа отправлена", {
        description: "Преподаватель проверит её в ближайшее время",
      });
    } catch (failure) {
      toast.error("Не удалось отправить работу", { description: apiErrorInfo(failure).error });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardBody className="space-y-5">
        {replacing && (
          <p className="rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">
            Новый ответ заменит работу, отправленную {formatDateTime(initial?.submittedAt)}.
          </p>
        )}
        <div>
          <label htmlFor="answer-text" className="mb-1.5 block text-sm font-medium">
            Текст ответа
          </label>
          <Textarea
            id="answer-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Опишите ваше решение…"
            className="min-h-[160px]"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium">Файл (необязательно)</span>
          {file ? (
            <p className="flex items-center gap-2 text-sm">
              <Paperclip size={14} aria-hidden className="text-muted-foreground" /> {file.name}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFile(undefined)}
                disabled={submitting}
                aria-label="Убрать файл"
              >
                <X size={14} aria-hidden />
              </Button>
            </p>
          ) : (
            <FileUpload
              kind="submission"
              courseId={courseId}
              disabled={submitting}
              label="Прикрепить файл"
              onUploaded={(uploaded) => setFile({ id: uploaded.id, name: uploaded.fileName })}
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              Отмена
            </Button>
          )}
          <Button onClick={submit} disabled={(!text.trim() && !file) || submitting} size="lg">
            {submitting ? "Отправка…" : replacing ? "Заменить работу" : "Отправить на проверку"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
