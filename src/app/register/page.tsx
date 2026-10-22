import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/AuthShell";
import { RegisterForm } from "@/features/auth/RegisterForm";
import { backendGet, getDataSource } from "@/shared/lib/backend";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Регистрация · HeliosEDU" };

export default async function RegisterPage() {
  const dataSource = await getDataSource();
  if (dataSource.source === "server" && (await backendGet("/api/auth/me"))?.ok) redirect("/dashboard");
  return (
    <AuthShell dataSource={dataSource} active="register">
      <RegisterForm source={dataSource.source} />
    </AuthShell>
  );
}
