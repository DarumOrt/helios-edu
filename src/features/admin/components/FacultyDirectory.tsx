"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, Card, CardBody, DataState, Dialog, Field, Input, Select } from "@/shared/ui";
import { api, apiErrorInfo } from "@/shared/lib/api-client";
import { useFaculties } from "@/shared/lib/use-faculties";
import type { FacultyInfo } from "@/shared/types/api.gen";

export function FacultyDirectory() {
  const { data, error, isLoading, mutate } = useFaculties();
  const [selected, select] = useState("");
  const [editing, edit] = useState<FacultyInfo | "new" | null>(null);
  const current = data?.find((f) => f.code === selected);
  return (
    <section className="mt-6 space-y-3" aria-labelledby="faculty-heading">
      <h2 id="faculty-heading" className="text-lg font-semibold">
        Факультеты
      </h2>
      <Card>
        <CardBody className="space-y-3">
          <DataState loading={isLoading} error={error}>
            <Field id="faculty-directory" label="Справочник факультетов">
              <Select
                className="w-full"
                id="faculty-directory"
                value={selected}
                onChange={(e) => select(e.target.value)}
              >
                <option value="">Выберите факультет</option>
                {data?.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code} · {f.name}
                    {f.archived ? " (архив)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => edit("new")}>Добавить факультет</Button>
              {current && (
                <Button variant="outline" onClick={() => edit(current)}>
                  Изменить факультет
                </Button>
              )}
            </div>
          </DataState>
        </CardBody>
      </Card>
      {editing && (
        <FacultyForm
          faculty={editing === "new" ? undefined : editing}
          onClose={() => edit(null)}
          onSaved={async (code) => {
            await mutate();
            select(code);
            edit(null);
          }}
        />
      )}
    </section>
  );
}

function FacultyForm({
  faculty,
  onClose,
  onSaved,
}: {
  faculty?: FacultyInfo;
  onClose: () => void;
  onSaved: (code: string) => Promise<void>;
}) {
  const [name, setName] = useState(faculty?.name ?? "");
  const [code, setCode] = useState(faculty?.code ?? "");
  const [archived, setArchived] = useState(faculty?.archived ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const path = "/api/faculties/" + encodeURIComponent(code);
    try {
      if (confirmDelete) await api.del(path);
      else if (faculty) await api.patch(path, { name, archived });
      else await api.post("/api/faculties", { code, name });
      await onSaved(confirmDelete ? "" : code.trim());
      toast.success(confirmDelete ? "Факультет удалён" : "Факультет сохранён");
    } catch (failure) {
      setError(apiErrorInfo(failure).error ?? "Не удалось сохранить изменения");
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={confirmDelete ? "Удалить факультет?" : faculty ? "Изменить факультет" : "Новый факультет"}
    >
      <form className="space-y-4" onSubmit={save}>
        {confirmDelete ? (
          <p>Факультет «{faculty?.name}» будет удалён из справочника.</p>
        ) : (
          <>
            <Field
              id="faculty-code"
              label="Короткий код"
              hint={faculty ? "Код используется в курсах, группах и CSV" : "Например, МФ"}
            >
              <Input
                id="faculty-code"
                required
                maxLength={50}
                disabled={!!faculty}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <Field id="faculty-name" label="Полное название">
              <Input
                id="faculty-name"
                required
                minLength={2}
                maxLength={180}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            {faculty && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />В
                архиве — скрыть для новых назначений
              </label>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {confirmDelete ? "Да, удалить" : "Сохранить"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={confirmDelete ? () => setConfirmDelete(false) : onClose}
          >
            Отмена
          </Button>
          {faculty && !confirmDelete && (
            <Button
              type="button"
              variant="ghost"
              className="text-danger"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              Удалить
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
