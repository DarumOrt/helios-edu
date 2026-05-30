import { Sidebar } from "@/shared/layout/Sidebar";
import { Header } from "@/shared/layout/Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 px-8 py-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
