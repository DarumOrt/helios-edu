import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-9 rounded-md border bg-card px-3 pr-8 text-sm shadow-soft transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-hidden",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
