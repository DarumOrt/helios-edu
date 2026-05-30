import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { TriangleAlert } from "lucide-react";

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
  emptyTitle = "Пока пусто",
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
  if (error) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Не удалось загрузить данные"
        description="Попробуйте обновить страницу"
      />
    );
  }
  if (empty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return <>{children}</>;
}
