"use client";

import { useState, type FormEvent } from "react";
import useSWR, { useSWRConfig } from "swr";
import { BookOpen, Pencil, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { can } from "@/shared/auth/permissions";
import { useSession } from "@/shared/auth/session";
import { api, fetcher } from "@/shared/lib/api-client";
import { useFaculties } from "@/shared/lib/use-faculties";
import {
  Breadcrumbs,
  Button,
  Card,
  CardBody,
  DataState,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
} from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import type { CatalogCollectionInfo, FacultyInfo } from "@/shared/types/api.gen";
import type { Course } from "@/shared/types/domain";
import { courseStatusMeta } from "../labels";

const endpoint = "/api/catalog-collections";

export function CatalogCollections() {
  const role = useSession((session) => session.role);
  const source = useSession((session) => session.dataSource.source);
  if (!can(role, "system.manage"))
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Доступ ограничен"
        description="Разделами каталога управляет администратор."
      />
    );

  return (
    <div>
      <PageHeader
        title="Межфакультетские разделы"
        subtitle="Подборки опубликованных курсов в каталоге"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Управление курсами", href: "/admin/courses" },
              { label: "Межфакультетские разделы" },
            ]}
          />
        }
      />
      {source === "server" ? (
        <CollectionList />
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Переключитесь на «Сервер»"
          description="В демо разделы каталога недоступны для редактирования."
        />
      )}
    </div>
  );
}

function CollectionList() {
  const { data, error, isLoading, mutate } = useSWR<CatalogCollectionInfo[]>(endpoint + "/manage", fetcher);
  const {
    data: courses,
    error: coursesError,
    isLoading: coursesLoading,
  } = useSWR<Course[]>("/api/courses", fetcher);
  const { data: faculties, error: facultiesError, isLoading: facultiesLoading } = useFaculties();
  const { mutate: refreshCatalog } = useSWRConfig();
  const [editing, edit] = useState<CatalogCollectionInfo | "new" | null>(null);

  return (
    <DataState
      loading={isLoading || coursesLoading || facultiesLoading}
      error={error ?? coursesError ?? facultiesError}
    >
      <div className="mb-4 flex justify-end">
        <Button onClick={() => edit("new")}>
          <Plus size={16} aria-hidden /> Создать раздел
        </Button>
      </div>
      {data?.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.map((item) => (
            <li key={item.id}>
              <Card className="h-full">
                <CardBody className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold wrap-break-word">{item.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{item.facultyCodes.join(", ")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Выбрано курсов {item.courseIds.length}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => edit(item)}
                    aria-label={`Изменить раздел «${item.name}»`}
                  >
                    <Pencil size={14} aria-hidden /> Изменить
                  </Button>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Разделов пока нет"
          description="Создайте раздел и добавьте в него курсы для нескольких факультетов."
        />
      )}
      {editing && (
        <CollectionDialog
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? undefined : editing}
          courses={courses ?? []}
          faculties={faculties ?? []}
          onClose={() => edit(null)}
          onSaved={() => {
            void mutate();
            void refreshCatalog(endpoint);
            edit(null);
          }}
        />
      )}
    </DataState>
  );
}

const toggle = (items: string[], value: string) =>
  items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

function CollectionDialog({
  item,
  courses,
  faculties,
  onClose,
  onSaved,
}: {
  item?: CatalogCollectionInfo;
  courses: Course[];
  faculties: FacultyInfo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [facultyCodes, setFacultyCodes] = useState(item?.facultyCodes ?? []);
  const [courseIds, setCourseIds] = useState(item?.courseIds ?? []);
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { pending, error, fields, reset, run } = useFormSubmit();
  const courseQuery = query.trim().toLowerCase();
  const matching = courses.filter(
    (course) =>
      courseIds.includes(course.id) || `${course.code} ${course.title}`.toLowerCase().includes(courseQuery),
  );
  const unavailable = courseIds.filter((id) => !courses.some((course) => course.id === id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const path = item ? endpoint + "/" + encodeURIComponent(item.id) : endpoint;
    const payload = { name, facultyCodes, courseIds };
    const saved = await run(async () => {
      if (deleting) await api.del(path);
      else if (item) await api.put(path, payload);
      else await api.post(path, payload);
      return true;
    });
    if (!saved) return;
    toast.success(deleting ? "Раздел удалён" : "Раздел сохранён");
    onSaved();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={deleting ? "Удалить раздел?" : item ? "Изменить раздел" : "Создать раздел"}
      className="max-w-xl"
      footer={
        <>
          {item && !deleting && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              disabled={pending}
              onClick={() => {
                reset();
                setDeleting(true);
              }}
            >
              Удалить раздел
            </Button>
          )}
          <Button
            variant="outline"
            disabled={pending}
            onClick={
              deleting
                ? () => {
                    reset();
                    setDeleting(false);
                  }
                : onClose
            }
          >
            Отмена
          </Button>
          <Button
            type="submit"
            form="catalog-collection-form"
            variant={deleting ? "danger" : "primary"}
            disabled={pending}
          >
            {pending ? "Сохраняем…" : deleting ? "Удалить" : "Сохранить"}
          </Button>
        </>
      }
    >
      <form id="catalog-collection-form" onSubmit={submit} className="space-y-5">
        {deleting ? (
          <p>Раздел «{item?.name}» исчезнет из каталога. Курсы останутся в своих факультетах.</p>
        ) : (
          <>
            <Field id="collection-name" label="Название" error={fields.name}>
              <Input
                id="collection-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <fieldset className="space-y-2" disabled={pending}>
              <legend className="text-sm font-medium">Факультеты</legend>
              <p className="text-xs text-muted-foreground">
                Выберите не меньше двух действующих факультетов.
              </p>
              <div className="max-h-36 overflow-y-auto rounded-md border">
                {faculties
                  .filter((faculty) => !faculty.archived || facultyCodes.includes(faculty.code))
                  .map((faculty) => (
                    <label
                      key={faculty.code}
                      className="flex min-h-10 items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className="shrink-0 accent-primary"
                        checked={facultyCodes.includes(faculty.code)}
                        onChange={() => setFacultyCodes((current) => toggle(current, faculty.code))}
                      />
                      <span className="min-w-0 wrap-break-word">
                        {faculty.name}
                        {faculty.archived && " (архив)"}
                      </span>
                    </label>
                  ))}
              </div>
              <FormError message={fields.facultyCodes ?? ""} />
            </fieldset>
            <fieldset className="space-y-2" disabled={pending}>
              <legend className="text-sm font-medium">Курсы</legend>
              <Input
                type="search"
                placeholder="Название или код курса"
                aria-label="Поиск курса для раздела"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Выбрано {courseIds.length}. В каталоге видны опубликованные курсы.
              </p>
              <div className="max-h-48 overflow-y-auto rounded-md border">
                {matching.map((course) => (
                  <label
                    key={course.id}
                    className="flex min-h-11 items-center gap-2 px-3 py-2 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      className="shrink-0 accent-primary"
                      checked={courseIds.includes(course.id)}
                      onChange={() => setCourseIds((current) => toggle(current, course.id))}
                    />
                    <span className="min-w-0 text-sm wrap-break-word">
                      {course.title}
                      <span className="block text-xs text-muted-foreground">
                        {course.code} {courseStatusMeta[course.status ?? "published"].label}
                      </span>
                    </span>
                  </label>
                ))}
                {unavailable.map((id) => (
                  <label key={id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked
                      onChange={() => setCourseIds((current) => current.filter((value) => value !== id))}
                    />
                    Курс в корзине
                  </label>
                ))}
                {matching.length === 0 && unavailable.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Курсы не найдены.</p>
                )}
              </div>
              <FormError message={fields.courseIds ?? ""} />
            </fieldset>
          </>
        )}
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
