import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/features/auth/AuthShell";
import { RegisterForm } from "@/features/auth/RegisterForm";
import type { Branding } from "@/shared/lib/branding";
import { backendGet, backendJson, getDataSource } from "@/shared/lib/backend";
import { registrationIsOpen } from "@/app/api/settings/registration-policy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Регистрация · HeliosEDU" };

export default async function RegisterPage() {
  const dataSource = await getDataSource();
  if (dataSource.source === "server" && (await backendGet("/api/auth/me"))?.ok) redirect("/dashboard");
  const [open, branding] = await Promise.all([registrationIsOpen(), backendJson<Branding>("/api/branding")]);
  return (
    <AuthShell
      dataSource={dataSource}
      active="register"
      allowRegistration={open}
      branding={branding?.ok ? branding.data : undefined}
    >
      {open ? (
        <RegisterForm source={dataSource.source} />
      ) : (
        <section aria-labelledby="register-title">
          <h1 id="register-title" className="text-2xl leading-tight font-semibold">
            Приём заявок закрыт
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            За доступом обратитесь к администратору. Если приглашение уже пришло на почту, откройте ссылку в
            письме.
          </p>
          <Link href="/login" className="mt-5 inline-block font-medium text-primary hover:underline">
            Вернуться ко входу
          </Link>
        </section>
      )}
    </AuthShell>
  );
}
