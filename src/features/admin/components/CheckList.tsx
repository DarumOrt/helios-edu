"use client";

import { useState } from "react";
import { Input } from "@/shared/ui";

export function CheckList({
  label,
  items,
  selected,
  onChange,
  disabled = false,
}: {
  label: string;
  items: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const visible = items.filter((i) => i.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">
        {label} · выбрано {selected.length}
      </legend>
      <Input
        aria-label={`Поиск: ${label}`}
        placeholder="Поиск…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
        {visible.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2 rounded p-2 text-sm hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))
              }
            />
            {item.name}
          </label>
        ))}
        {!visible.length && <p className="p-2 text-sm text-muted-foreground">Ничего не найдено</p>}
      </div>
    </fieldset>
  );
}
