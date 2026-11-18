"use client";

import Image from "next/image";
import { useId, useState, type ChangeEvent } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { useUiStore } from "@/stores/ui-store";
import { BrandMark, Button, describedBy, Dialog, Field, Input, Textarea } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { api } from "@/shared/lib/api-client";
import {
  brandingLogo,
  brandingPath,
  defaultBranding,
  useBranding,
  type Branding,
} from "@/shared/lib/branding";

export function BrandingControl() {
  const allowed = useSession((s) => s.backendEnabled && can(s.role, "system.manage"));
  const editing = useUiStore((s) => s.editingBrand);
  const setEditing = useUiStore((s) => s.setEditingBrand);
  const open = useUiStore((s) => s.brandingOpen);
  const setOpen = useUiStore((s) => s.setBrandingOpen);

  if (!allowed) return null;

  return (
    <>
      <Button
        variant={editing ? "outline" : "ghost"}
        size="sm"
        aria-label="Режим редактирования оформления"
        aria-pressed={editing}
        title="Режим редактирования оформления"
        onClick={() => {
          setEditing(!editing);
          if (!editing) setOpen(true);
        }}
      >
        <Pencil size={16} aria-hidden />
        <span className="hidden xl:inline">{editing ? "Завершить редактирование" : "Оформление"}</span>
      </Button>
      {open && <BrandingDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function BrandingDialog({ onClose }: { onClose: () => void }) {
  const { data, error, mutate } = useBranding();
  return data ? (
    <BrandingForm current={data} onClose={onClose} onSave={(brand) => void mutate(brand, false)} />
  ) : (
    <Dialog open title="Оформление организации" onClose={onClose}>
      {error ? "Не удалось получить текущие настройки. Откройте редактор ещё раз." : "Загружаем оформление…"}
    </Dialog>
  );
}

function BrandingForm({
  current,
  onClose,
  onSave,
}: {
  current: Branding;
  onClose: () => void;
  onSave: (brand: Branding) => void;
}) {
  const id = useId();
  const [initial] = useState(() => ({ ...defaultBranding, ...current }));
  const [draft, setDraft] = useState(initial);
  const [logo, setLogo] = useState<string | null>();
  const [reading, setReading] = useState(false);
  const { pending, error, fields, run, setFields } = useFormSubmit();
  const busy = reading || pending;
  const defaults = logo === null || (logo === undefined && !current.logoVersion);
  const src = logo ?? brandingLogo(defaults ? undefined : current.logoVersion);

  async function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const invalid = "Выберите PNG, JPEG или WebP до 512 КБ";
    setFields({});
    if (file.size > 512 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setFields({ logo: invalid });
      return;
    }
    setReading(true);
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setLogo(data);
    } catch {
      setFields({ logo: "Не удалось открыть изображение" });
    } finally {
      setReading(false);
    }
  }

  async function save() {
    const body: Record<string, string | null> = {};
    for (const key of ["subtitle", "loginText", "footerText"] as const) {
      if (draft[key] !== initial[key]) body[key] = draft[key] === defaultBranding[key] ? null : draft[key];
    }
    if (logo !== undefined) body.logo = logo?.split(",")[1] ?? null;
    const result = await run(() => api.put<Branding>(brandingPath, body));
    if (!result) return;
    onSave(result);
    toast.success("Оформление опубликовано");
    onClose();
  }

  return (
    <Dialog
      open
      title="Оформление организации"
      description="Проверьте, как будут выглядеть логотип и тексты. Правки появятся на сайте после сохранения."
      onClose={onClose}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form={id} disabled={busy}>
            {pending ? "Сохраняем…" : "Сохранить оформление"}
          </Button>
        </>
      }
    >
      <form
        id={id}
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset className="space-y-4" disabled={busy}>
          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-lg font-bold">
              <BrandMark size={24} /> HeliosEDU
            </div>
            <Field id={id + "-subtitle"} label="Подпись под названием" error={fields.subtitle}>
              <Input
                id={id + "-subtitle"}
                {...describedBy(id + "-subtitle", fields.subtitle)}
                maxLength={32}
                placeholder={defaultBranding.subtitle}
                value={draft.subtitle}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              />
            </Field>
          </div>
          <div className="space-y-4 rounded-xl border p-4">
            <h3 className="font-semibold">Страница входа</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Image
                src={src}
                alt="Предпросмотр логотипа"
                width={160}
                height={80}
                unoptimized
                className="h-20 w-40 rounded-lg border bg-white object-contain"
              />
              <div>
                <input
                  id={id + "-logo"}
                  type="file"
                  className="peer sr-only"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void selectLogo(e)}
                />
                <label
                  htmlFor={id + "-logo"}
                  className="inline-flex cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:bg-muted"
                >
                  Выбрать логотип
                </label>
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, WebP до 512 КБ</p>
              </div>
            </div>
            <FormError message={fields.logo} />
            <Field id={id + "-login"} label="Текст приветствия" error={fields.loginText}>
              <Textarea
                rows={2}
                className="resize-y"
                id={id + "-login"}
                {...describedBy(id + "-login", fields.loginText)}
                maxLength={200}
                placeholder={defaultBranding.loginText}
                value={draft.loginText}
                onChange={(e) => setDraft({ ...draft, loginText: e.target.value.replace(/[\r\n]+/g, " ") })}
              />
            </Field>
            <Field id={id + "-footer"} label="Подпись внизу страницы" error={fields.footerText}>
              <Textarea
                rows={2}
                className="resize-y"
                id={id + "-footer"}
                {...describedBy(id + "-footer", fields.footerText)}
                maxLength={120}
                placeholder={defaultBranding.footerText}
                value={draft.footerText}
                onChange={(e) => setDraft({ ...draft, footerText: e.target.value.replace(/[\r\n]+/g, " ") })}
              />
            </Field>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(defaultBranding);
              setLogo(null);
              setFields({});
            }}
          >
            Восстановить исходное оформление
          </Button>
        </fieldset>
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
