import Link from "next/link";
import { BrandMark, buttonVariants } from "@/shared/ui";

export const metadata = { title: "Страница не найдена · HeliosEDU" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <BrandMark size={34} />
      </span>
      <p className="mt-6 font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Такой страницы нет</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Возможно, ссылка устарела или курс сняли с публикации.
      </p>
      <Link href="/dashboard" className={buttonVariants({ className: "mt-6" })}>
        На главную
      </Link>
    </main>
  );
}
