"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Avatar, Badge, Button, Dialog, Input } from "@/shared/ui";
import type { Cohort, User } from "@/shared/types/domain";
import { adminApi, refreshManagement } from "../api";
import { FormError, useFormSubmit } from "../use-form-submit";

// Состав группы целиком. Студент состоит в одной группе: отмеченный из другой группы перейдёт сюда.
export function MembersDialog({
  open,
  onClose,
  cohort,
  students,
}: {
  open: boolean;
  onClose: () => void;
  cohort: Cohort;
  students: User[];
}) {
  const [selected, setSelected] = useState(() => new Set(cohort.memberIds));
  // порядок строк — по составу на момент открытия, чтобы строки не прыгали под курсором
  const [initial] = useState(() => new Set(cohort.memberIds));
  const [query, setQuery] = useState("");
  const { pending, error, run } = useFormSubmit();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
      .sort((a, b) => Number(initial.has(b.id)) - Number(initial.has(a.id)) || a.name.localeCompare(b.name));
  }, [students, query, initial]);

  const moving = students.filter((s) => selected.has(s.id) && s.group && s.group !== cohort.name).length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    const saved = await run(() => adminApi.setMembers(cohort.id, [...selected]));
    if (!saved) return;
    await refreshManagement();
    toast.success("Состав группы сохранён", {
      description: `${cohort.name} · ${saved.memberIds.length} студентов`,
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Состав группы ${cohort.name}`}
      description="Студенты группы зачислены на её курсы."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Сохраняем…" : `Сохранить · ${selected.size}`}
          </Button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          aria-label="Поиск студента"
          placeholder="Имя или почта"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      {moving > 0 && (
        <p className="mb-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          {moving} {moving === 1 ? "студент перейдёт" : "студента перейдут"} из другой группы
        </p>
      )}
      <ul className="-mx-2 max-h-80 overflow-y-auto">
        {list.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-muted-foreground">Никого не нашли</li>
        )}
        {list.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggle(s.id)}
                disabled={pending}
                className="size-4 shrink-0 accent-primary"
              />
              <Avatar name={s.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.email}</span>
              </span>
              {s.group && s.group !== cohort.name && <Badge tone="outline">сейчас в {s.group}</Badge>}
              {!s.group && <Badge tone="neutral">без группы</Badge>}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <FormError message={error} />
      </div>
    </Dialog>
  );
}
