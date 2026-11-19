"use client";

import { useState, type FormEvent } from "react";
import useSWR, { mutate } from "swr";
import { KeyRound, Search, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { api, fetcher } from "@/shared/lib/api-client";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataState,
  Dialog,
  Field,
  Input,
  Select,
  describedBy,
} from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { keywordError } from "@/shared/lib/enrollment";
import type { Cohort, EnrollmentInfo, EnrolledStudent } from "@/shared/types/domain";

const sourceLabel = { group: "Через группу", manual: "Вручную", self: "По кодовому слову" };

type AccessChange = {
  action: "exclude" | "restore" | "exclude-group" | "detach";
  target: string;
  label: string;
  affected: EnrolledStudent[];
  kept?: number;
  assigned?: boolean;
};

export function EnrollmentPanel({ courseId, readOnly = false }: { courseId: string; readOnly?: boolean }) {
  const url = `/api/courses/${courseId}/enrollment`;
  const { data, error, isLoading } = useSWR<EnrollmentInfo>(url, fetcher);
  const { data: cohorts, error: groupsError } = useSWR<Cohort[]>("/api/cohorts", fetcher);
  return (
    <DataState loading={isLoading || (!cohorts && !groupsError)} error={error ?? groupsError} empty={!data}>
      {data &&
        cohorts &&
        (readOnly ? (
          <Card>
            <CardHeader title="Участники ваших групп" />
            <CardBody className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {cohorts
                  .filter((group) => data.cohortIds.includes(group.id))
                  .map((group) => group.name)
                  .join(", ")}
              </p>
              {data.students.length ? (
                <ul className="divide-y">
                  {data.students.map((student) => (
                    <li key={student.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>{student.name}</span>
                      <span className="text-muted-foreground">{student.group}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm">В назначенных группах пока нет студентов.</p>
              )}
            </CardBody>
          </Card>
        ) : (
          <EnrollmentForm
            key={JSON.stringify(data.cohortIds)}
            courseId={courseId}
            data={data}
            cohorts={cohorts}
          />
        ))}
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
  const [groupId, setGroupId] = useState("");
  const [change, setChange] = useState<AccessChange | null>(null);
  const [studentToRemove, setStudentToRemove] = useState<EnrolledStudent | null>(null);
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
  const individuallyEnrolled = new Set(
    data.students.filter((s) => s.sources.some((source) => source !== "group")).map((s) => s.id),
  );
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
  const memberGroups = new Set(data.students.map((s) => s.group));
  const rosterGroups = cohorts.filter((g) => data.cohortIds.includes(g.id) || memberGroups.has(g.name));
  const selected = rosterGroups.find((g) => g.id === groupId);
  const members = selected ? data.students.filter((s) => s.group === selected.name) : [];
  function chooseGroup(action: "exclude-group" | "detach") {
    if (!selected) return;
    const affected =
      action === "detach" ? members.filter((s) => s.sources.every((source) => source === "group")) : members;
    setChange({
      action,
      target: selected.id,
      label: selected.name,
      affected,
      kept: members.length - affected.length,
      assigned: data.cohortIds.includes(selected.id),
    });
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
                        disabled={
                          pending ||
                          individuallyEnrolled.has(s.id) ||
                          data.excluded.some((x) => x.id === s.id)
                        }
                        onClick={() => addStudent(s.id)}
                      >
                        {data.excluded.some((x) => x.id === s.id)
                          ? "Доступ исключён"
                          : individuallyEnrolled.has(s.id)
                            ? "Уже записан индивидуально"
                            : "Записать индивидуально"}
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
                    disabled={data.cohortIds.includes(g.id)}
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
      {rosterGroups.length > 0 && (
        <Card>
          <CardHeader title="Действия с группой" />
          <CardBody className="space-y-3">
            <Field id="roster-group" label="Учебная группа">
              <Select id="roster-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Выберите группу</option>
                {rosterGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!members.length}
                onClick={() => chooseGroup("exclude-group")}
              >
                Исключить студентов группы
              </Button>
              <Button
                variant="outline"
                disabled={!data.cohortIds.includes(groupId)}
                onClick={() => chooseGroup("detach")}
              >
                Снять группу с курса
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
      <Card>
        <CardHeader title="Участники курса" />
        <CardBody>
          {data.students.length ? (
            <ul className="divide-y">
              {data.students.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs break-all text-muted-foreground">
                      {s.email} · {s.group ?? "Без группы"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.sources.map((source) => (
                        <Badge key={source}>{sourceLabel[source]}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {individuallyEnrolled.has(s.id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Снять индивидуальную запись: ${s.name}`}
                        onClick={() => setStudentToRemove(s)}
                      >
                        Снять индивидуальную запись
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Исключить: ${s.name}`}
                      onClick={() =>
                        setChange({ action: "exclude", target: s.id, label: s.name, affected: [s] })
                      }
                    >
                      Исключить
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-5 text-center text-sm text-muted-foreground">Пока никто не записан.</p>
          )}
        </CardBody>
      </Card>
      {data.excluded.length > 0 && (
        <Card>
          <CardHeader title="Исключённые студенты" />
          <CardBody>
            <ul className="divide-y">
              {data.excluded.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs break-all text-muted-foreground">
                      {s.email} · {s.group ?? "Без группы"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Восстановить доступ: ${s.name}`}
                    onClick={() =>
                      setChange({ action: "restore", target: s.id, label: s.name, affected: [s] })
                    }
                  >
                    Восстановить доступ
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
      {change && (
        <AccessDialog change={change} root={root} onClose={() => setChange(null)} refresh={refresh} />
      )}
      {studentToRemove && (
        <RemoveEnrollmentDialog
          student={studentToRemove}
          root={root}
          onClose={() => setStudentToRemove(null)}
          refresh={refresh}
        />
      )}
    </div>
  );
}

function AccessDialog({
  change,
  root,
  onClose,
  refresh,
}: {
  change: AccessChange;
  root: string;
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const { pending, error, run } = useFormSubmit();
  const { action, affected } = change;
  const title = {
    exclude: "Исключить студента",
    restore: "Восстановить доступ",
    "exclude-group": "Исключить студентов группы",
    detach: "Снять группу с курса",
  }[action];
  async function confirm() {
    const success = await run(async () => {
      await api.post(`${root}/enrollment/access/${action}/${encodeURIComponent(change.target)}`, {
        studentIds: affected.map((s) => s.id),
      });
      return true;
    });
    await refresh();
    if (success) {
      onClose();
      toast.success("Состав курса обновлён");
    }
  }
  return (
    <Dialog
      open
      title={title + "?"}
      description={change.label}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Отмена
          </Button>
          <Button variant={action === "restore" ? "primary" : "danger"} disabled={pending} onClick={confirm}>
            {pending ? "Сохраняем…" : "Подтвердить"}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {action === "restore" ? (
          <p>
            Студент снова получит доступ к опубликованному курсу. Если прежнее основание записи исчезло, будет
            создана индивидуальная запись.
          </p>
        ) : action === "detach" ? (
          <p>
            Потеряют доступ через группу: {affected.length}. Сохранят индивидуальный доступ: {change.kept}.
            Новые студенты группы больше не будут записываться автоматически.
          </p>
        ) : (
          <p>
            Потеряют доступ к курсу: {affected.length}. Запись через группу и вход по кодовому слову будут
            закрыты до восстановления доступа.
            {action === "exclude-group" &&
              change.assigned &&
              " Группа останется назначенной. Новые студенты получат доступ."}
          </p>
        )}
        {(action === "exclude-group" || action === "detach") && affected.length > 0 && (
          <ul aria-label="Потеряют доступ" className="max-h-36 list-inside list-disc overflow-y-auto">
            {affected.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        )}
        <p>Оценки, сданные работы и прогресс сохранятся.</p>
        <FormError message={error} />
      </div>
    </Dialog>
  );
}

function RemoveEnrollmentDialog({
  student,
  root,
  onClose,
  refresh,
}: {
  student: EnrolledStudent;
  root: string;
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const { pending, error, run } = useFormSubmit();
  async function remove() {
    const removed = await run(async () => {
      await api.del(`${root}/enrollment/students/${encodeURIComponent(student.id)}`);
      return true;
    });
    if (!removed) return;
    onClose();
    toast.success("Индивидуальная запись снята");
    await refresh();
  }
  return (
    <Dialog
      open
      title="Снять индивидуальную запись?"
      description={student.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Отмена
          </Button>
          <Button variant="danger" disabled={pending} onClick={remove}>
            {pending ? "Снимаем…" : "Снять запись"}
          </Button>
        </>
      }
    >
      <p className="text-sm">
        {student.sources.includes("group")
          ? "Доступ к курсу сохранится через назначенную группу."
          : "Студент потеряет доступ к курсу. Если запись по кодовому слову включена, он сможет записаться снова."}{" "}
        Оценки, сданные работы и прогресс сохранятся.
      </p>
      <FormError message={error} />
    </Dialog>
  );
}
