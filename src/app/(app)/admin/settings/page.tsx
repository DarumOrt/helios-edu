"use client";

import useSWR from "swr";
import { toast } from "sonner";
import { api, apiErrorInfo, fetcher } from "@/shared/lib/api-client";
import { Card, CardBody, DataState, EmptyState, PageHeader } from "@/shared/ui";
import { useSession } from "@/shared/auth/session";
import { can } from "@/shared/auth/permissions";
import { ShieldAlert } from "lucide-react";

interface Settings {
  allowRegistration: boolean;
  announcementsEnabled: boolean;
}

const items: { key: keyof Settings; title: string; on: string; off: string }[] = [
  {
    key: "allowRegistration",
    title: "Открытая регистрация студентов",
    on: "Студенты сами создают учётную запись на странице регистрации",
    off: "Регистрация закрыта — учётные записи создаёт организатор",
  },
  {
    key: "announcementsEnabled",
    title: "Объявления преподавателей",
    on: "Преподаватели отправляют объявления студентам своих курсов",
    off: "Кнопка «Объявление» отвечает отказом",
  },
];

export default function SettingsPage() {
  const role = useSession((s) => s.role);
  const { data, error, isLoading, mutate } = useSWR<Settings>("/api/settings", fetcher);

  if (!can(role, "system.manage"))
    return (
      <EmptyState icon={ShieldAlert} title="Доступ ограничен" description="Раздел доступен администратору." />
    );

  async function toggle(key: keyof Settings, value: boolean) {
    try {
      await mutate(api.put<Settings>("/api/settings", { [key]: value }), {
        optimisticData: (s) => ({ ...s!, [key]: value }),
        rollbackOnError: true,
      });
      toast.success(value ? "Включено" : "Выключено", {
        description: items.find((i) => i.key === key)?.title,
      });
    } catch (failure) {
      toast.error(apiErrorInfo(failure).error ?? "Не удалось сохранить настройку");
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Настройки системы"
        subtitle="Изменения действуют сразу и попадают в журнал действий"
      />
      <DataState loading={isLoading} error={error} empty={!data}>
        <Card>
          <CardBody className="divide-y p-0">
            {items.map((item) => {
              const value = data?.[item.key] ?? false;
              return (
                <label key={item.key} className="flex cursor-pointer items-start gap-4 px-5 py-4">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {value ? item.on : item.off}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-checked={value}
                    checked={value}
                    onChange={(e) => toggle(item.key, e.target.checked)}
                    className="mt-1 size-5 shrink-0 cursor-pointer accent-primary"
                  />
                </label>
              );
            })}
          </CardBody>
        </Card>
      </DataState>
    </div>
  );
}
