import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
}) {
  return (
    <div className="mb-7">
      {breadcrumbs && <div className="mb-3">{breadcrumbs}</div>}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
    </div>
  );
}
