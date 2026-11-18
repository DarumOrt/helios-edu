import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/AuthShell";
import { DemoLogin } from "@/features/auth/DemoLogin";
import { LoginForm } from "@/features/auth/LoginForm";
import { registrationIsOpen } from "@/app/api/settings/registration-policy";
import { backendGet, getDataSource } from "@/shared/lib/backend";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Вход · HeliosEDU" };

export default async function LoginPage() {
  const dataSource = await getDataSource();
  // Уже вошедшему на сервере нечего делать на странице входа
  if (dataSource.source === "server" && (await backendGet("/api/auth/me"))?.ok) redirect("/dashboard");
  const allowRegistration = await registrationIsOpen();
  return (
    <AuthShell dataSource={dataSource} active="login" allowRegistration={allowRegistration}>
      {dataSource.source === "server" ? (
        <LoginForm allowRegistration={allowRegistration} />
      ) : (
        <DemoLogin allowRegistration={allowRegistration} />
      )}
    </AuthShell>
  );
}
