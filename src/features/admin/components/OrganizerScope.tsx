"use client";

import { Select } from "@/shared/ui";
import { useFaculties } from "@/shared/lib/use-faculties";
import { CheckList } from "./CheckList";

export function OrganizerScope({
  value,
  onChange,
}: {
  value: string[] | null;
  onChange: (codes: string[] | null) => void;
}) {
  const { data } = useFaculties();
  return (
    <fieldset className="space-y-3">
      <label className="block space-y-1 text-sm font-medium">
        Полномочия организатора
        <Select
          className="w-full"
          value={value === null ? "all" : "selected"}
          onChange={(e) => onChange(e.target.value === "all" ? null : [])}
        >
          <option value="all">Весь вуз</option>
          <option value="selected">Выбранные факультеты</option>
        </Select>
      </label>
      {value && (
        <CheckList
          label="Факультеты организатора"
          items={(data ?? [])
            .filter((f) => !f.archived || value.includes(f.code))
            .map((f) => ({ id: f.code, name: f.code + " · " + f.name }))}
          selected={value}
          onChange={onChange}
        />
      )}
    </fieldset>
  );
}
