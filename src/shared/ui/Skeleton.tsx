import { cn } from "@/shared/lib/utils";
import type { HTMLAttributes } from "react";

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-linear-to-r from-muted via-muted/60 to-muted bg-size-[200%_100%]",
        className,
      )}
      {...rest}
    />
  );
}
