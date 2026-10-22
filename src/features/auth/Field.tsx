"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/shared/ui";
export { Field, describedBy } from "@/shared/ui/Field";
import { cn } from "@/shared/lib/utils";

export const AuthInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <Input
      ref={ref}
      className={cn(
        "h-11 text-base aria-invalid:border-danger aria-invalid:ring-danger/30 sm:text-sm",
        className,
      )}
      {...rest}
    />
  ),
);
AuthInput.displayName = "AuthInput";

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, id, ...rest }, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <AuthInput
        ref={ref}
        id={id}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
      >
        {visible ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
