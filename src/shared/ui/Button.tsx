import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft",
        secondary: "bg-primary-soft text-primary hover:bg-primary-soft/70",
        outline: "border bg-card hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        danger: "bg-danger text-white hover:bg-danger/90 shadow-soft",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant, size, ...rest }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...rest} />
  )
);
Button.displayName = "Button";
