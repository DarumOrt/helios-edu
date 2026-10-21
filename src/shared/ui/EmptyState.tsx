import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Пустое состояние не должно весить как данные: компактно, без иконки в круге.
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
      <Icon size={20} className="mb-2 text-muted-foreground" aria-hidden />
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
