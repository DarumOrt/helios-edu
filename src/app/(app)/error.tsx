"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/shared/ui";

// Сбой на странице кабинета: меню и шапка остаются, вместо страницы — понятное сообщение и повтор.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
      <p className="mt-2 text-muted-foreground">
        Страница не загрузилась. Попробуйте ещё раз — если не поможет, вернитесь на главную.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">Код ошибки: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw size={16} aria-hidden />
          Попробовать снова
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          На главную
        </Link>
      </div>
    </div>
  );
}
