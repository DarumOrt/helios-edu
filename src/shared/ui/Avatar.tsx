import { cn, initials } from "@/shared/lib/utils";

// Инициалы на нейтральном фоне: аватар не должен спорить за внимание с данными.
export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border bg-muted font-semibold text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.36) }}
      role="img"
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
