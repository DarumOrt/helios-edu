import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { SearchX, ShieldAlert, TriangleAlert } from "lucide-react";
import { ApiError } from "@/shared/lib/api-client";

interface Props {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  skeleton?: ReactNode;
  children: ReactNode;
}

export function DataState({
  loading,
  error,
  empty,
  emptyTitle = "Здесь пока ничего нет",
  emptyDescription,
  skeleton,
  children,
}: Props) {
  if (loading) {
    return (
      skeleton ?? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      )
    );
  }
  // 404 и 403 — не сбой: обновление страницы не поможет (чужой курс API отдаёт как несуществующий)
  if (error instanceof ApiError && error.status === 404) {
    return (
      <EmptyState
        icon={SearchX}
        title="Не найдено"
        description="Такой страницы нет или она вам недоступна — проверьте ссылку"
      />
    );
  }
  if (error instanceof ApiError && error.status === 403) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Нет доступа"
        description="Этот раздел недоступен для вашей роли"
      />
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Не удалось загрузить данные"
        description="Обновите страницу — обычно это помогает"
      />
    );
  }
  if (empty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return <>{children}</>;
}
