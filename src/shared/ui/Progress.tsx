import { cn } from "@/shared/lib/utils";

export function Progress({
  value,
  className,
  tone = "primary",
}: {
  value: number;
  className?: string;
  tone?: "primary" | "success" | "warning";
}) {
  const v = Math.max(0, Math.min(100, value));
  const color =
    tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary";
  return (
    <div className={cn("w-full h-1.5 bg-muted rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
