"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/shared/lib/api-client";
import { type UserImportReport as Report, type Cohort } from "@/shared/types/domain";
import { Button, Card, Field, Input, Select, Table, THead, TR, TH, TD } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { csvHeaders, downloadCsv } from "../import-csv";
import { refreshManagement } from "../api";

const fields = { name: "Имя и фамилия", email: "Почта", group: "Группа", faculty: "Факультет" };
const statuses: Record<string, string> = {
  created: "Создать",
  updated: "Изменить группу",
  skipped: "Пропустить",
  error: "Ошибка",
};

export function ImportUsers() {
  const { data: cohorts } = useSWR<Cohort[]>("/api/cohorts", fetcher);
  const [csv, setCsv] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [columns, setColumns] = useState<Record<string, number>>({});
  const [group, setGroup] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [sendInvitations, setSendInvitations] = useState(true);
  const [requestId, setRequestId] = useState("");
  const [report, setReport] = useState<Report>();
  const [done, setDone] = useState(false);
  const [fileError, setFileError] = useState("");
  const { pending, error, run } = useFormSubmit();
  function resetPreview() {
    setReport(undefined);
    setDone(false);
    setRequestId(crypto.randomUUID());
  }
  async function preview(commit: boolean) {
    const result = await run(() =>
      api.post<Report>(`/api/users/import${commit ? "" : "/preview"}`, {
        requestId,
        csv,
        columns,
        group,
        updateExisting,
        sendInvitations,
      }),
    );
    if (result) {
      setReport(result);
      setDone(commit);
      if (commit) await refreshManagement();
    }
  }
  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <p className="text-sm text-muted-foreground">
          CSV в UTF-8, до 1 МБ и 1000 строк. Разделитель — запятая или точка с запятой. Новые учётные записи
          получают роль «Студент». Студент состоит в одной группе: назначение другой группы переводит его в
          неё.
        </p>
        <Button
          variant="outline"
          onClick={() =>
            downloadCsv("users-template.csv", [
              ["name", "email", "group", "faculty"],
              ["Иван Примеров", "ivan@example.org", "М1227", "ИНЭК"],
            ])
          }
        >
          Скачать CSV-шаблон
        </Button>
        <Field id="import-file" label="CSV-файл">
          <Input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            onChange={async (e) => {
              resetPreview();
              setFileError("");
              setCsv("");
              setHeaders([]);
              setColumns({});
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 1_000_000) {
                setFileError("Файл больше 1 МБ");
                return;
              }
              try {
                const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
                const names = csvHeaders(text);
                setCsv(text);
                setHeaders(names);
                setColumns(
                  Object.fromEntries(
                    Object.keys(fields)
                      .filter((key) => names.includes(key))
                      .map((key) => [key, names.indexOf(key)]),
                  ),
                );
              } catch {
                setFileError("Не удалось прочитать UTF-8. Пересохраните CSV в UTF-8.");
              }
            }}
          />
        </Field>
        {!!headers.length && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(fields).map(([key, label]) => (
              <Field key={key} id={`column-${key}`} label={label}>
                <Select
                  id={`column-${key}`}
                  className="w-full"
                  disabled={pending || done}
                  value={columns[key] ?? ""}
                  onChange={(e) => {
                    resetPreview();
                    setColumns((previous) => {
                      const next = { ...previous };
                      if (e.target.value === "") delete next[key];
                      else next[key] = Number(e.target.value);
                      return next;
                    });
                  }}
                >
                  <option value="">
                    {key === "name" || key === "email" ? "Выберите колонку" : "Не использовать"}
                  </option>
                  {headers.map((name, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {name}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        )}
        <Field id="import-group" label="Группа для всех строк">
          <Select
            id="import-group"
            value={group}
            disabled={pending || done}
            onChange={(e) => {
              setGroup(e.target.value);
              resetPreview();
            }}
          >
            <option value="">Из CSV (если пусто — без группы)</option>
            {cohorts?.map((g) => (
              <option key={g.id} value={g.name}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            disabled={pending || done}
            checked={updateExisting}
            onChange={(e) => {
              setUpdateExisting(e.target.checked);
              resetPreview();
            }}
          />
          Переводить существующих студентов в указанную группу, сохраняя их данные
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            disabled={pending || done}
            checked={sendInvitations}
            onChange={(e) => {
              setSendInvitations(e.target.checked);
              resetPreview();
            }}
          />
          Отправить новым пользователям ссылки активации (нужен настроенный SMTP)
        </label>
        <FormError message={fileError || error} />
        <div className="flex flex-wrap gap-3">
          <Button disabled={!csv || pending || done} onClick={() => preview(false)}>
            Предпросмотр и проверка
          </Button>
          {report && !done && (
            <Button disabled={pending || report.created + report.updated === 0} onClick={() => preview(true)}>
              {pending ? "Импортируем…" : "Подтвердить импорт"}
            </Button>
          )}
        </div>
      </Card>
      {report && (
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">{done ? "Импорт завершён" : "Предварительная проверка"}</h2>
          <p>
            {done ? "Создано" : "Будет создано"}: {report.created} · Группа изменена: {report.updated} ·
            Пропущено: {report.skipped} · Ошибок: {report.errors}
          </p>
          {done && (
            <p className="text-sm text-muted-foreground">
              Повторная загрузка файла не создаёт дубликаты. Приглашения отправляются в фоне. Если отправка
              отключена, пригласите пользователей из раздела рассылок.
            </p>
          )}
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv("import-errors.csv", [
                ["row", "name", "email", "group", "error"],
                ...report.rows.filter((r) => r.error).map((r) => [r.row, r.name, r.email, r.group, r.error]),
              ])
            }
          >
            Скачать отчёт об ошибках
          </Button>
          <div className="max-h-96 overflow-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Строка</TH>
                  <TH>Имя</TH>
                  <TH>Почта</TH>
                  <TH>Группа</TH>
                  <TH>Результат</TH>
                </TR>
              </THead>
              <tbody>
                {report.rows.map((r) => (
                  <TR key={r.row}>
                    <TD>{r.row}</TD>
                    <TD>{r.name}</TD>
                    <TD>{r.email}</TD>
                    <TD>{r.group || "—"}</TD>
                    <TD>
                      {r.error ||
                        (done
                          ? (
                              {
                                created: "Создан",
                                updated: "Группа изменена",
                                skipped: "Пропущен",
                              } as Record<string, string>
                            )[r.status]
                          : statuses[r.status])}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
