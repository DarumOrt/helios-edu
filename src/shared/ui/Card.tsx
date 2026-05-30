import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground border rounded-xl shadow-soft transition",
        className
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
    <div className={cn("flex items-start justify-between p-5 border-b", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h3 className="font-semibold text-foreground leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
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
  return <div className={cn("px-5 py-3 border-t bg-muted/30 rounded-b-xl", className)} {...rest} />;
}
