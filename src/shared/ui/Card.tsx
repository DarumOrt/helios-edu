import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

// Карточка — белый лист на небесном фоне: без рамки, с едва заметной тенью.
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-transparent bg-card text-card-foreground shadow-card",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5 pb-2", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
        <div className="min-w-0">
          <h3 className="leading-tight font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-b-2xl border-t bg-muted/40 px-5 py-3", className)} {...rest} />;
}
