import { cn, gradientFor, initials } from "@/shared/lib/utils";

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-linear-to-br font-semibold text-white",
        gradientFor(name),
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
