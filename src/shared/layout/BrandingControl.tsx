"use client";

import { useId, useState } from "react";
import { LogoEditor } from "./LogoEditor";
import { BrandIdentity } from "./BrandIdentity";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { useUiStore } from "@/stores/ui-store";
import { Button, describedBy, Dialog, Field, Input, Textarea } from "@/shared/ui";
import { FormError, useFormSubmit } from "@/shared/ui/form-submit";
import { api } from "@/shared/lib/api-client";
import {
  brandingPath,
  defaultBranding,
  useBranding,
  usesLogo,
  type LogoDrafts,
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
  const [logos, setLogos] = useState<LogoDrafts>({});
  const [scale, setScale] = useState(current.logoScale ?? 100);
  const [mode, setMode] = useState<boolean | null>(current.useLogo ?? null);
  const [reading, setReading] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const { pending, error, fields, run } = useFormSubmit();
  const busy = reading || pending;
  const preview: Branding = {
    subtitle: draft.subtitle === defaultBranding.subtitle ? undefined : draft.subtitle || undefined,
    useLogo: mode ?? undefined,
    logoScale: scale,
    logoVersion: logos.light === null ? undefined : current.logoVersion,
    darkLogoVersion: logos.dark === null ? undefined : current.darkLogoVersion,
  };
  const showLogos = usesLogo(preview);

  async function save() {
    const body: Record<string, string | number | boolean | null> = {};
    for (const key of ["subtitle", "loginText", "footerText"] as const) {
      if (draft[key] !== initial[key]) body[key] = draft[key] === defaultBranding[key] ? null : draft[key];
    }
    if (scale !== (current.logoScale ?? 100)) body.logoScale = scale === 100 ? null : scale;
    if (mode !== (current.useLogo ?? null)) body.useLogo = mode;
    if (logos.light !== undefined) body.logo = logos.light?.split(",")[1] ?? null;
    if (logos.dark !== undefined) body.darkLogo = logos.dark?.split(",")[1] ?? null;
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
          <fieldset className="rounded-xl border bg-muted/40 p-4">
            <legend className="mb-2 text-sm font-semibold">Под названием HeliosEDU</legend>
            <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="brand-mode" checked={showLogos} onChange={() => setMode(true)} />
                Логотип
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="brand-mode" checked={!showLogos} onChange={() => setMode(false)} />
                Текстовая подпись
              </label>
            </div>
            <Field
              id={id + "-subtitle"}
              label={showLogos ? "Подпись, если для темы нет логотипа" : "Подпись под названием"}
              error={fields.subtitle}
            >
              <Input
                id={id + "-subtitle"}
                {...describedBy(id + "-subtitle", fields.subtitle)}
                maxLength={32}
                placeholder={defaultBranding.subtitle}
                value={draft.subtitle}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              />
            </Field>
          </fieldset>
          {showLogos && (
            <Field id={id + "-scale"} label="Масштаб логотипа" error={fields.logoScale}>
              <div className="flex items-center gap-3">
                <input
                  id={id + "-scale"}
                  type="range"
                  min={50}
                  max={130}
                  value={scale}
                  aria-valuetext={scale + "%"}
                  {...describedBy(id + "-scale", fields.logoScale)}
                  onChange={(e) => setScale(e.target.valueAsNumber)}
                  className="w-full accent-primary"
                />
                <output htmlFor={id + "-scale"} className="w-12 text-right text-sm tabular-nums">
                  {scale}%
                </output>
              </div>
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {(["light", "dark"] as const).map((theme) => (
              <div key={theme} className="min-w-0 space-y-2">
                <section
                  className={
                    theme === "dark"
                      ? "min-w-0 rounded-xl border bg-slate-950 p-3 text-white"
                      : "min-w-0 rounded-xl border bg-white p-3 text-slate-950"
                  }
                >
                  <h3 className="mb-3 text-xs font-semibold">
                    {theme === "dark" ? "Тёмная тема" : "Светлая тема"}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="mb-1 block text-xs opacity-80">Страница входа</span>
                      <BrandIdentity branding={preview} drafts={logos} theme={theme} />
                    </div>
                    <div>
                      <span className="mb-1 block text-xs opacity-80">Боковое меню</span>
                      <BrandIdentity branding={preview} drafts={logos} theme={theme} compact />
                    </div>
                  </div>
                </section>
                {showLogos && (
                  <LogoEditor
                    key={resetCount}
                    theme={theme}
                    removable={Boolean(
                      logos[theme] ??
                      (logos[theme] === undefined &&
                        (theme === "dark" ? current.darkLogoVersion : current.logoVersion)),
                    )}
                    setReading={setReading}
                    error={theme === "dark" ? fields.darkLogo : fields.logo}
                    onChange={(value) => {
                      setMode(true);
                      setLogos((previous) => ({ ...previous, [theme]: value }));
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="space-y-4 rounded-xl border p-4">
            <h3 className="font-semibold">Тексты на входе</h3>
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
              setMode(null);
              setScale(100);
              setLogos({ light: null, dark: null });
              setResetCount((count) => count + 1);
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
