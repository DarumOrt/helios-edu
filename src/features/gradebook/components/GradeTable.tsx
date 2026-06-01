"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { fetcher } from "@/shared/lib/api-client";
import { DataState, Table, THead, TR, TH, TD, Card, Avatar, Badge } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { gradebookApi } from "../api";
import type { GradeRow } from "@/shared/types/domain";

function gradeTone(grade: number | null, max: number): "success" | "info" | "warning" | "danger" | "neutral" {
  if (grade == null) return "neutral";
  const p = grade / max;
  if (p >= 0.85) return "success";
  if (p >= 0.7) return "info";
  if (p >= 0.5) return "warning";
  return "danger";
}

export function GradeTable({ courseId, editable = false }: { courseId: string; editable?: boolean }) {
  const key = `/api/gradebook?courseId=${courseId}`;
  const { data, error, isLoading } = useSWR<GradeRow[]>(key, fetcher);
  const { mutate } = useSWRConfig();
  const items = data?.[0]?.items ?? [];

  async function save(userId: string, itemId: string, value: string) {
    const grade = value.trim() === "" ? null : Number(value);
    if (grade != null && (Number.isNaN(grade) || grade < 0 || grade > 100)) {
      toast.error("Оценка должна быть 0–100");
      return;
    }
    try {
      await gradebookApi.setGrade(courseId, userId, itemId, grade);
      mutate(key);
      toast.success("Оценка сохранена");
    } catch {
      toast.error("Не удалось сохранить");
    }
  }

  return (
    <Card className="overflow-hidden">
      {editable && (
        <div className="px-4 py-2 bg-primary-soft/40 border-b text-xs text-primary flex items-center gap-1.5">
          <Pencil size={12} /> Режим редактирования: нажмите на оценку, чтобы изменить
        </div>
      )}
      <DataState loading={isLoading} error={error} empty={!data?.length}>
        <Table>
          <THead>
            <TR>
              <TH>Студент</TH>
              {items.map((it) => (
                <TH key={it.itemId}>{it.itemTitle}</TH>
              ))}
              <TH>Итог</TH>
            </TR>
          </THead>
          <tbody>
            {data?.map((row) => (
              <TR key={row.userId}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.userName} size={28} />
                    <span className="font-medium">{row.userName}</span>
                  </div>
                </TD>
                {row.items.map((it) =>
                  editable ? (
                    <TD key={it.itemId}>
                      <EditableGrade
                        value={it.grade}
                        max={it.max}
                        onSave={(v) => save(row.userId, it.itemId, v)}
                      />
                    </TD>
                  ) : (
                    <TD key={it.itemId}>
                      {it.grade == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge tone={gradeTone(it.grade, it.max)}>
                          {it.grade}/{it.max}
                        </Badge>
                      )}
                    </TD>
                  )
                )}
                <TD>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      row.total >= 80
                        ? "text-success"
                        : row.total >= 60
                        ? "text-primary"
                        : row.total >= 40
                        ? "text-warning"
                        : "text-danger"
                    )}
                  >
                    {row.total.toFixed(1)}
                  </span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </DataState>
    </Card>
  );
}

function EditableGrade({
  value,
  max,
  onSave,
}: {
  value: number | null;
  max: number;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== (value != null ? String(value) : "")) onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value != null ? String(value) : "");
            setEditing(false);
          }
        }}
        className="w-16 h-7 rounded border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
    );
  }

  const tone = gradeTone(value, max);
  return (
    <button
      onClick={() => {
        setDraft(value != null ? String(value) : "");
        setEditing(true);
      }}
      className="group inline-flex items-center gap-1 hover:opacity-80"
      title="Изменить оценку"
    >
      {value == null ? (
        <span className="text-muted-foreground border border-dashed rounded px-2 py-0.5 text-xs">
          поставить
        </span>
      ) : (
        <Badge tone={tone}>
          {value}/{max}
        </Badge>
      )}
      <Pencil size={11} className="opacity-0 group-hover:opacity-60 text-muted-foreground" />
    </button>
  );
}
