"use client";

import type { ComponentProps } from "react";
import { Select } from "@/shared/ui";
import { useFaculties } from "@/shared/lib/use-faculties";

export function FacultySelect(props: ComponentProps<typeof Select>) {
  const { data, error } = useFaculties();
  return (
    <Select {...props} className="w-full" disabled={props.disabled || !data}>
      <option value="">
        {error ? "Не удалось загрузить факультеты" : !data ? "Загрузка…" : "Без факультета"}
      </option>
      {data
        ?.filter((f) => !f.archived || f.code === props.value)
        .map((f) => (
          <option key={f.code} value={f.code}>
            {f.code} · {f.name}
            {f.archived ? " (архив)" : ""}
          </option>
        ))}
    </Select>
  );
}
