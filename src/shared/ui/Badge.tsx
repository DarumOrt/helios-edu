import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "border-transparent bg-muted text-muted-foreground",
        primary: "border-primary/10 bg-primary-soft text-primary",
        success: "border-success/10 bg-success-soft text-success",
        warning: "border-warning/10 bg-warning-soft text-warning",
        info: "border-primary/10 bg-primary-soft text-primary",
        danger: "border-danger/10 bg-danger-soft text-danger",
        outline: "bg-transparent text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

interface Props extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...rest }: Props) {
  return <span className={cn(badgeVariants({ tone }), className)} {...rest} />;
}
