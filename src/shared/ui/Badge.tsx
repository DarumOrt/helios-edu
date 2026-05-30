import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground border-transparent",
        primary: "bg-primary-soft text-primary border-primary/10",
        success: "bg-success-soft text-success border-success/10",
        warning: "bg-warning-soft text-warning border-warning/10",
        info: "bg-primary-soft text-primary border-primary/10",
        danger: "bg-danger-soft text-danger border-danger/10",
        outline: "bg-transparent text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

interface Props extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...rest }: Props) {
  return <span className={cn(badgeVariants({ tone }), className)} {...rest} />;
}
