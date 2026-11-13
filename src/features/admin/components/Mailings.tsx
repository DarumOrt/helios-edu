"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/shared/lib/api-client";
import { type User, type Cohort } from "@/shared/types/domain";
import {
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Table,
  THead,
  TR,
  TH,
  TD,
  DataState,
  Select,
} from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { CheckList } from "./CheckList";
import { type Campaign, mailStatus } from "../mail";

export function Mailings() {
  const { data: users, error: usersError, isLoading: usersLoading } = useSWR<User[]>("/api/users", fetcher);
  const {
    data: groups,
    error: groupsError,
    isLoading: groupsLoading,
  } = useSWR<Cohort[]>("/api/cohorts", fetcher);
  const {
    data: history,
    error: historyError,
    isLoading: historyLoading,
    mutate,
  } = useSWR<Campaign[]>("/api/mail/campaigns", fetcher, { refreshInterval: 5000 });
  const [userIds, setUserIds] = useState<string[]>([]);
  const [cohortIds, setCohortIds] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [count, setCount] = useState<number>();
  const [sent, setSent] = useState(false);
  const [inviteId, setInviteId] = useState("");
  const [notice, setNotice] = useState("");
  const [detailsId, setDetailsId] = useState("");
  const {
    data: details,
    error: detailsError,
    isLoading: detailsLoading,
  } = useSWR<{ email: string; status: string; attempts: number; error?: string }[]>(
    detailsId ? `/api/mail/campaigns/${detailsId}` : null,
    fetcher,
    { refreshInterval: 5000 },
  );
  const { pending, error, run } = useFormSubmit();
  const audience = { userIds, cohortIds, all };
  function edited() {
    setPreview(false);
    setCount(undefined);
    setSent(false);
    setRequestId("");
    setConfirmAll(false);
  }
  return (
    <div className="space-y-5">
      <p className="text-sm">
        <Link href="/admin/mail/settings" className="text-primary underline">
          Настройки SMTP и автоматических уведомлений
        </Link>
      </p>
      <DataState error={usersError || groupsError} loading={usersLoading || groupsLoading}>
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Создать рассылку</h2>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={all}
              disabled={pending}
              onChange={(e) => {
                edited();
                setAll(e.target.checked);
              }}
            />
            Все активные пользователи платформы
          </label>
          {!all && (
            <div className="grid gap-4 md:grid-cols-2">
              <CheckList
                label="Пользователи"
                items={(users ?? [])
                  .filter((u) => u.status !== "blocked")
                  .map((u) => ({ id: u.id, name: `${u.name} · ${u.email}` }))}
                selected={userIds}
                onChange={(ids) => {
                  edited();
                  setUserIds(ids);
                }}
                disabled={pending}
              />
              <CheckList
                label="Группы"
                items={groups ?? []}
                selected={cohortIds}
                onChange={(ids) => {
                  edited();
                  setCohortIds(ids);
                }}
                disabled={pending}
              />
            </div>
          )}
          <Field id="mail-subject" label="Тема">
            <Input
              id="mail-subject"
              maxLength={200}
              value={subject}
              disabled={pending}
              onChange={(e) => {
                edited();
                setSubject(e.target.value);
              }}
            />
          </Field>
          <Field id="mail-text" label="Текстовая версия">
            <Textarea
              id="mail-text"
              rows={5}
              maxLength={50000}
              value={text}
              disabled={pending}
              onChange={(e) => {
                edited();
                setText(e.target.value);
              }}
            />
          </Field>
          <details>
            <summary className="cursor-pointer text-sm font-medium">HTML-шаблон (необязательно)</summary>
            <Textarea
              aria-label="HTML письма"
              className="mt-3 font-mono"
              rows={6}
              maxLength={100000}
              value={html}
              disabled={pending}
              onChange={(e) => {
                edited();
                setHtml(e.target.value);
              }}
            />
          </details>
          <Button
            variant="outline"
            disabled={pending || !subject.trim() || !text.trim()}
            onClick={async () => {
              const result = await run(() => api.post<{ count: number }>("/api/mail/audience", audience));
              if (result) {
                setCount(result.count);
                setPreview(true);
                if (!requestId) setRequestId(crypto.randomUUID());
              }
            }}
          >
            Предпросмотр и количество получателей
          </Button>
          {preview && (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold">{subject}</h3>
              <p>Получателей: {count}. Повторяющиеся адреса исключены.</p>
              {html ? (
                <iframe
                  title="Предпросмотр письма"
                  className="h-72 w-full rounded border bg-white"
                  sandbox=""
                  referrerPolicy="no-referrer"
                  srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">${html}`}
                />
              ) : (
                <p className="whitespace-pre-wrap">{text}</p>
              )}
              {all && (
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmAll}
                    onChange={(e) => setConfirmAll(e.target.checked)}
                  />
                  Подтверждаю отправку всем активным пользователям
                </label>
              )}
              <Button
                disabled={pending || sent || !count || (all && !confirmAll)}
                onClick={async () => {
                  const result = await run(() =>
                    api.post<Campaign>("/api/mail/campaigns", {
                      requestId,
                      audience,
                      subject,
                      text,
                      html: html || null,
                      confirmAll,
                    }),
                  );
                  if (result) {
                    setSent(true);
                    setNotice(`Рассылка поставлена в очередь: ${result.total} получателей`);
                    await mutate();
                  }
                }}
              >
                {sent ? "Добавлено в очередь" : pending ? "Добавляем…" : "Отправить рассылку"}
              </Button>
            </div>
          )}
          <FormError message={error} />
          {notice && <p role="status">{notice}</p>}
        </Card>
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Пригласить пользователя</h2>
          <p className="text-sm text-muted-foreground">
            Отправляет одноразовую ссылку для установки пароля. Срок действия — 48 часов.
          </p>
          <Select aria-label="Кого пригласить" value={inviteId} onChange={(e) => setInviteId(e.target.value)}>
            <option value="">Выберите пользователя</option>
            {users
              ?.filter((u) => u.status !== "blocked")
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.email}
                </option>
              ))}
          </Select>
          <Button
            variant="outline"
            disabled={pending || !inviteId}
            onClick={async () => {
              const result = await run(() =>
                api.post<{ message: string }>(`/api/mail/invite/${encodeURIComponent(inviteId)}`, {}),
              );
              if (result) {
                setNotice(result.message);
                await mutate();
              }
            }}
          >
            Отправить приглашение
          </Button>
        </Card>
      </DataState>
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">История рассылок</h2>
        <p className="text-sm text-muted-foreground">
          «Принято SMTP» означает приём сервером исходящей почты. Доставка в почтовый ящик не подтверждена.
          Последние 100 рассылок.
        </p>
        <DataState error={historyError} loading={historyLoading}>
          <Table>
            <THead>
              <TR>
                <TH>Тема</TH>
                <TH>Статус</TH>
                <TH>Принято SMTP</TH>
                <TH>Ошибок</TH>
                <TH>Ожидает</TH>
              </TR>
            </THead>
            <tbody>
              {history?.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <button className="text-left text-primary underline" onClick={() => setDetailsId(c.id)}>
                      {c.subject}
                    </button>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString("ru")}
                    </div>
                  </TD>
                  <TD>{mailStatus[c.status]}</TD>
                  <TD>
                    {c.sent}/{c.total}
                  </TD>
                  <TD>{c.failed}</TD>
                  <TD>{c.pending}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </DataState>
        {detailsId && (
          <DataState error={detailsError} loading={detailsLoading}>
            <div className="max-h-80 overflow-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Получатель</TH>
                    <TH>Статус</TH>
                    <TH>Попыток</TH>
                    <TH>Ошибка</TH>
                  </TR>
                </THead>
                <tbody>
                  {details?.map((r) => (
                    <TR key={r.email}>
                      <TD>{r.email}</TD>
                      <TD>{mailStatus[r.status]}</TD>
                      <TD>{r.attempts}</TD>
                      <TD>{r.error || "—"}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>
          </DataState>
        )}
      </Card>
    </div>
  );
}
