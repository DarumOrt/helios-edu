import { Sidebar } from "@/shared/layout/Sidebar";
import { Header } from "@/shared/layout/Header";
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
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
