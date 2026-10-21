import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-px text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-transparent bg-muted text-muted-foreground",
        primary: "border-transparent bg-primary-soft text-primary",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning",
        info: "border-transparent bg-muted text-foreground",
        danger: "border-transparent bg-danger-soft text-danger",
        highlight: "border-transparent bg-highlight text-highlight-foreground",
        outline: "bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

interface Props extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...rest }: Props) {
  return <span className={cn(badgeVariants({ tone }), className)} {...rest} />;
}
