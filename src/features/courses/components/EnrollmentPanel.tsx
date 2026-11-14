"use client";

import { useState, type FormEvent } from "react";
import useSWR, { mutate } from "swr";
import { KeyRound, Search, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { api, fetcher } from "@/shared/lib/api-client";
import { Badge, Button, Card, CardBody, CardHeader, DataState, Field, Input, describedBy } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { keywordError } from "@/shared/lib/enrollment";
import type { Cohort, EnrollmentInfo, EnrolledStudent } from "@/shared/types/domain";

const sourceLabel = { group: "Через группу", manual: "Вручную", self: "По кодовому слову" };

export function EnrollmentPanel({ courseId }: { courseId: string }) {
  const url = `/api/courses/${courseId}/enrollment`;
  const { data, error, isLoading } = useSWR<EnrollmentInfo>(url, fetcher);
  const { data: cohorts, error: groupsError } = useSWR<Cohort[]>("/api/cohorts", fetcher);
  return (
    <DataState loading={isLoading || (!cohorts && !groupsError)} error={error ?? groupsError} empty={!data}>
      {data && cohorts && (
        <EnrollmentForm
          key={JSON.stringify(data.cohortIds)}
          courseId={courseId}
          data={data}
          cohorts={cohorts}
        />
      )}
    </DataState>
  );
}

function EnrollmentForm({
  courseId,
  data,
  cohorts,
}: {
  courseId: string;
  data: EnrollmentInfo;
  cohorts: Cohort[];
}) {
  const root = `/api/courses/${courseId}`;
  const [keyword, setKeyword] = useState("");
  const [q, setQ] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [cohortIds, setCohortIds] = useState(data.cohortIds);
  const { pending, fields, error, run, setFields } = useFormSubmit();
  const {
    data: matches,
    error: searchError,
    isLoading: searching,
  } = useSWR<EnrolledStudent[]>(
    q.trim().length >= 2 ? `${root}/enrollment/students?q=${encodeURIComponent(q.trim())}` : null,
    fetcher,
    { keepPreviousData: false },
  );
  const enrolled = new Set(data.students.map((s) => s.id));
  async function refresh() {
    await mutate(
      (key) =>
        typeof key === "string" &&
        (key.startsWith("/api/courses") || key === "/api/cohorts" || key === "/api/catalog"),
    );
  }
  async function saveKeyword(event: FormEvent) {
    event.preventDefault();
    const invalid = keywordError(keyword);
    if (invalid) {
      setFields({ keyword: invalid });
      return;
    }
    if (await run(() => api.put(`${root}/enrollment/key`, { keyword: keyword.trim() }))) {
      setKeyword("");
      await refresh();
      toast.success("Кодовое слово сохранено");
    }
  }
  async function disableKey() {
    if (await run(() => api.put(`${root}/enrollment/key`, { keyword: null }))) {
      setKeyword("");
      await refresh();
      toast.success("Самостоятельная запись отключена");
    }
  }
  async function addStudent(userId: string) {
    if (await run(() => api.post(`${root}/enrollment/students`, { userId }))) {
      await refresh();
      toast.success("Студент записан на курс");
    }
  }
  async function saveGroups() {
    if (await run(() => api.patch(root, { cohortIds }))) {
      await refresh();
      toast.success("Группы курса сохранены");
    }
  }
  const groupsChanged = [...cohortIds].sort().join() !== [...data.cohortIds].sort().join();
  const visibleGroups = cohorts.filter((g) => g.name.toLowerCase().includes(groupQuery.toLowerCase()));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Запись на курс</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Выберите один или несколько способов. Студент учитывается в составе курса один раз.
          </p>
        </div>
        <Badge tone="primary">Участников: {data.students.length}</Badge>
      </div>
      <FormError message={error || fields.userId || ""} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="По кодовому слову" icon={<KeyRound size={18} />} />
          <CardBody className="space-y-4">
            <Badge tone={data.keyEnabled ? "success" : "neutral"}>
              {data.keyEnabled ? "Самозапись включена" : "Самозапись выключена"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Студент находит курс в поиске и вводит слово в его карточке. Курс должен быть опубликован.
            </p>
            <form onSubmit={saveKeyword} className="space-y-3">
              <Field
                id="enrollment-key"
                label={data.keyEnabled ? "Новое кодовое слово" : "Кодовое слово"}
                error={fields.keyword}
                hint="От 4 до 64 символов. Регистр учитывается."
              >
                <Input
                  id="enrollment-key"
                  type="password"
                  autoComplete="new-password"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  maxLength={64}
                  disabled={pending}
                  {...describedBy("enrollment-key", fields.keyword, true)}
                />
              </Field>
              <Button type="submit" disabled={pending}>
                {data.keyEnabled ? "Сменить слово" : "Включить самозапись"}
              </Button>
            </form>
            {data.keyEnabled && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={disableKey}>
                Отключить самозапись
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Смена слова и отключение не исключают уже записанных студентов.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Индивидуально" icon={<UserPlus size={18} />} />
          <CardBody className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Найдите студента по фамилии или электронной почте. Его учебная группа останется прежней.
            </p>
            <div className="relative">
              <Search size={16} aria-hidden className="absolute top-3 left-3 text-muted-foreground" />
              <Input
                aria-label="Фамилия или почта студента"
                placeholder="Фамилия или почта…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={100}
                className="pl-9"
              />
            </div>
            {q.trim().length < 2 && (
              <p className="text-xs text-muted-foreground">Введите хотя бы 2 символа.</p>
            )}
            {q.trim().length >= 2 && (
              <DataState
                loading={searching}
                error={searchError}
                empty={matches?.length === 0}
                emptyTitle="Студенты не найдены"
              >
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {matches?.map((s) => (
                    <li key={s.id} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="mt-1 text-xs break-all text-muted-foreground">
                        {s.email} · {s.group ?? "Без группы"}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={pending || enrolled.has(s.id)}
                        onClick={() => addStudent(s.id)}
                      >
                        {enrolled.has(s.id) ? "Уже на курсе" : "Записать"}
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  До 20 совпадений. Уточните запрос, если нужного студента нет.
                </p>
              </DataState>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Целиком группу" icon={<UsersRound size={18} />} />
          <CardBody className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Назначьте курс нескольким группам. Новые студенты выбранных групп получат доступ автоматически.
            </p>
            <Input
              aria-label="Поиск учебной группы"
              placeholder="Найти группу…"
              value={groupQuery}
              onChange={(e) => setGroupQuery(e.target.value)}
            />
            <fieldset disabled={pending} className="max-h-52 space-y-1 overflow-y-auto">
              <legend className="sr-only">Группы курса</legend>
              {visibleGroups.map((g) => (
                <label
                  key={g.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={cohortIds.includes(g.id)}
                    onChange={(e) =>
                      setCohortIds((ids) =>
                        e.target.checked ? [...ids, g.id] : ids.filter((id) => id !== g.id),
                      )
                    }
                    className="size-4 accent-primary"
                  />
                  <span className="flex-1 text-sm">{g.name}</span>
                  <span className="text-xs text-muted-foreground">{g.memberIds.length} чел.</span>
                </label>
              ))}
              {!visibleGroups.length && <p className="text-sm text-muted-foreground">Группы не найдены.</p>}
            </fieldset>
            <FormError message={fields.cohortIds ?? ""} />
            <Button disabled={pending || !groupsChanged} onClick={saveGroups}>
              Сохранить группы ({cohortIds.length})
            </Button>
            <p className="text-xs text-muted-foreground">
              При снятии группы индивидуальные записи и записи по слову сохраняются.
            </p>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Участники курса" />
        <CardBody>
          {data.students.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Студент</th>
                    <th className="px-3 py-2 font-medium">Группа</th>
                    <th className="px-3 py-2 font-medium">Способ записи</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.students.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-3">
                        <p className="font-medium">{s.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{s.email}</p>
                      </td>
                      <td className="px-3 py-3">{s.group ?? "Без группы"}</td>
                      <td className="px-3 py-3">
                        <Badge>{sourceLabel[s.source]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-5 text-center text-sm text-muted-foreground">
              Пока никто не записан. Добавьте студентов любым из способов выше.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
