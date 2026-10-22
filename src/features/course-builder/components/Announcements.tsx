"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { Button, Card, CardBody, CardHeader, Dialog, Field, Input, Textarea, describedBy } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { formatDateTime } from "@/shared/lib/format";
import type { Announcement } from "@/shared/types/domain";
import { builderApi, refreshCourse } from "../api";

/** Последние объявления курса — видят все, кому виден курс */
export function AnnouncementsCard({ courseId }: { courseId: string }) {
  const { data } = useSWR<Announcement[]>(`/api/courses/${courseId}/announcements`, fetcher);
  if (!data?.length) return null;
  return (
    <Card className="mb-5">
      <CardHeader title="Объявления" icon={<Megaphone size={18} />} />
      <CardBody className="pt-1">
        <ul className="divide-y">
          {data.slice(0, 3).map((a) => (
            <li key={a.id} className="py-3 first:pt-0 last:pb-0">
              <div className="text-sm font-medium">{a.title}</div>
              <p className="mt-1 text-sm whitespace-pre-line text-foreground/80">{a.body}</p>
              <div className="mt-1.5 text-xs text-muted-foreground">
                {a.authorName} · <span className="font-mono">{formatDateTime(a.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export function AnnouncementDialog({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { pending, fields, error, run, setFields } = useFormSubmit();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (title.trim().length < 3) clientErrors.title = "Заголовок — от 3 до 120 символов";
    if (!body.trim()) clientErrors.body = "Текст — от 1 до 2000 символов";
    if (Object.keys(clientErrors).length) {
      setFields(clientErrors);
      return;
    }
    const saved = await run(() => builderApi.announce(courseId, title, body));
    if (!saved) return;
    await refreshCourse(courseId);
    toast.success("Объявление отправлено", { description: "Студенты курса увидят его в уведомлениях" });
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Объявление курсу"
      description="Придёт уведомлением всем студентам групп этого курса."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" form="announce-form" disabled={pending}>
            {pending ? "Отправляем…" : "Отправить"}
          </Button>
        </>
      }
    >
      <form id="announce-form" onSubmit={submit} noValidate className="space-y-4">
        <Field id="an-title" label="Заголовок" error={fields.title}>
          <Input
            id="an-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            disabled={pending}
            {...describedBy("an-title", fields.title)}
          />
        </Field>
        <Field id="an-body" label="Текст" error={fields.body}>
          <Textarea
            id="an-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            disabled={pending}
            {...describedBy("an-body", fields.body)}
          />
        </Field>
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
