import { AppChrome } from "@/shared/layout/AppChrome";
import { redirect } from "next/navigation";
import { backendGet, getDataSource } from "@/shared/lib/backend";
import { SessionProvider } from "@/shared/auth/session";
import { type User } from "@/shared/types/domain";

// Сессия проверяется на каждом запросе, в том числе в Docker с runtime-переменными.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const dataSource = await getDataSource();
  let user: User | null = null;
  if (dataSource.source === "server") {
    const response = await backendGet("/api/auth/me");
    if (response?.status === 401) redirect("/login");
    if (!response?.ok)
      return (
        <main className="mx-auto max-w-lg p-12">
          <h1 className="text-xl font-semibold">Сервис временно недоступен</h1>
          <p className="mt-3 text-muted-foreground">Не удалось проверить сессию. Попробуйте ещё раз.</p>
          <a className="mt-5 inline-block text-primary underline" href="/dashboard">
            Повторить
          </a>
        </main>
      );
    user = (await response.json()) as User;
  }
  return (
    <SessionProvider initialUser={user} dataSource={dataSource}>
      <div
        className="flex min-h-screen"
        data-helios-preview={user?.previewContext ?? undefined}
        data-helios-inspection={user?.role === "admin" ? "" : undefined}
      >
        <AppChrome>{children}</AppChrome>
      </div>
    </SessionProvider>
  );
}
