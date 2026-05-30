import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("min-w-full text-sm", className)} {...rest} />
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-muted/50 text-muted-foreground text-left text-xs uppercase tracking-wider">
      {children}
    </thead>
  );
}

export function TR({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn("border-b last:border-b-0 hover:bg-muted/30 transition", className)}>{children}</tr>;
}

export function TH({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

export function TD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
