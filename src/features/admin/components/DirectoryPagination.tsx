import { Button } from "@/shared/ui";

export function DirectoryPagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages < 2) return null;
  return (
    <nav
      aria-label="Страницы списка"
      className="flex flex-wrap items-center justify-between gap-2 border-t p-3"
    >
      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => onChange(page - 1)}>
        Назад
      </Button>
      <span aria-live="polite" className="text-sm text-muted-foreground">
        Страница {page} из {pages}
      </span>
      <Button variant="outline" size="sm" disabled={page === pages} onClick={() => onChange(page + 1)}>
        Вперёд
      </Button>
    </nav>
  );
}
