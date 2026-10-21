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
  const color = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary";
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* scaleX вместо width — без перерасчёта layout на каждом кадре */}
      <div
        className={cn("h-full origin-left rounded-full transition-transform duration-300 ease-out", color)}
        style={{ transform: `scaleX(${v / 100})` }}
      />
    </div>
  );
}
