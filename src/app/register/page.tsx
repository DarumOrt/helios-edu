import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/AuthShell";
import { RegisterForm } from "@/features/auth/RegisterForm";
import { backendGet, backendJson, getDataSource } from "@/shared/lib/backend";
import { getSettings } from "@/mocks/settings-store";
import type { SystemSettings } from "@/shared/types/domain";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Регистрация · HeliosEDU" };

export default async function RegisterPage() {
  const dataSource = await getDataSource();
  if (dataSource.source === "server" && (await backendGet("/api/auth/me"))?.ok) redirect("/dashboard");
  // на сервере настройка — в C#; если API недоступен, форму показываем, а C# всё равно проверит при отправке
  const server = await backendJson<SystemSettings>("/api/settings");
  const open = server ? !server.ok || server.data.allowRegistration : getSettings().allowRegistration;
  return (
    <AuthShell dataSource={dataSource} active="register">
      {open ? (
        <RegisterForm source={dataSource.source} />
      ) : (
        <section aria-labelledby="register-title">
          <h1 id="register-title" className="text-2xl leading-tight font-semibold">
            Регистрация закрыта
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Учётную запись создаёт организатор вашего факультета. Если вы её уже получили — войдите по почте.
          </p>
        </section>
      )}
    </AuthShell>
  );
}
